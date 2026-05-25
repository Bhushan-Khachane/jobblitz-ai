from __future__ import annotations

import logging
import os

import stripe
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_PRO_MONTHLY = os.environ.get("STRIPE_PRICE_PRO_MONTHLY", "")
STRIPE_PRICE_PRO_YEARLY = os.environ.get("STRIPE_PRICE_PRO_YEARLY", "")
STRIPE_PRICE_ELITE_MONTHLY = os.environ.get("STRIPE_PRICE_ELITE_MONTHLY", "")
STRIPE_PRICE_ELITE_YEARLY = os.environ.get("STRIPE_PRICE_ELITE_YEARLY", "")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["billing"])

PRICE_MAP = {
    "pro_monthly": STRIPE_PRICE_PRO_MONTHLY,
    "pro_yearly": STRIPE_PRICE_PRO_YEARLY,
    "elite_monthly": STRIPE_PRICE_ELITE_MONTHLY,
    "elite_yearly": STRIPE_PRICE_ELITE_YEARLY,
}


def _get_price_id(plan: str, billing: str) -> str:
    key = f"{plan}_{billing}"
    price_id = PRICE_MAP.get(key)
    if not price_id:
        raise HTTPException(status_code=400, detail="Invalid plan or billing cycle")
    return price_id


@router.post("/create-checkout-session")
async def create_checkout_session(
    request: Request,
    body: dict,
    user: User = Depends(get_current_user),
):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    plan = body.get("plan", "pro")
    billing = body.get("billing", "monthly")
    price_id = _get_price_id(plan, billing)

    success_url = f"{settings.WEB_URL}/dashboard?upgraded=true"
    cancel_url = f"{settings.WEB_URL}/pricing"

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
        customer_email=user.email,
        metadata={"userId": str(user.id), "plan": plan},
    )

    return {"sessionId": session.id, "url": session.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook secret not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError as e:
        logger.warning(f"Stripe webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        background_tasks.add_task(_handle_checkout_completed, data, db)
    elif event_type == "customer.subscription.deleted":
        background_tasks.add_task(_handle_subscription_deleted, data, db)
    elif event_type == "invoice.payment_failed":
        background_tasks.add_task(_handle_payment_failed, data, db)

    return {"status": "ok"}


async def _handle_checkout_completed(data: dict, db: AsyncSession):
    user_id = data.get("metadata", {}).get("userId")
    plan = data.get("metadata", {}).get("plan", "pro")
    customer_id = data.get("customer")
    subscription_id = data.get("subscription")

    if not user_id:
        logger.warning("Stripe checkout completed without userId metadata")
        return

    from app.models import Subscription

    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    sub = result.scalar_one_or_none()

    if sub:
        sub.plan = plan
        sub.status = "active"
        sub.stripe_customer_id = customer_id
        sub.stripe_subscription_id = subscription_id
    else:
        sub = Subscription(
            user_id=user_id,
            plan=plan,
            status="active",
            stripe_customer_id=customer_id,
            stripe_subscription_id=subscription_id,
        )
        db.add(sub)

    await db.commit()
    logger.info(f"Upgraded user {user_id} to plan {plan}")


async def _handle_subscription_deleted(data: dict, db: AsyncSession):
    customer_id = data.get("customer")
    if not customer_id:
        return

    from app.models import Subscription

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    sub = result.scalar_one_or_none()

    if sub:
        sub.plan = "free"
        sub.status = "canceled"
        await db.commit()
        logger.info(f"Downgraded user {sub.user_id} to free")


async def _handle_payment_failed(data: dict, db: AsyncSession):
    customer_id = data.get("customer")
    logger.warning(f"Payment failed for customer {customer_id}")
    # Future: send email warning


@router.get("/portal")
async def create_portal_session(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    from app.models import Subscription

    result = await db.execute(
        select(Subscription).where(Subscription.user_id == str(user.id))
    )
    sub = result.scalar_one_or_none()

    if not sub or not sub.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No active subscription found")

    session = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=f"{settings.WEB_URL}/dashboard",
    )

    return {"url": session.url}


@router.get("/status")
async def billing_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models import Subscription

    result = await db.execute(
        select(Subscription).where(Subscription.user_id == str(user.id))
    )
    sub = result.scalar_one_or_none()

    plan = sub.plan if sub else "free"

    limits = {
        "free": {"applicationsPerDay": 10, "resumeTailoring": 0, "coverLetters": 0},
        "pro": {"applicationsPerDay": 50, "resumeTailoring": 5, "coverLetters": 5},
        "elite": {"applicationsPerDay": None, "resumeTailoring": 50, "coverLetters": 50},
    }

    # Count today's applications
    from datetime import datetime, timezone
    from sqlalchemy import func
    from app.models import Application

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    app_count_result = await db.execute(
        select(func.count()).where(
            Application.user_id == str(user.id),
            Application.created_at >= today,
        )
    )
    apps_today = app_count_result.scalar() or 0

    return {
        "plan": plan,
        "status": sub.status if sub else "active",
        "currentPeriodEnd": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        "limits": limits.get(plan, limits["free"]),
        "usageToday": {
            "applications": apps_today,
        },
        "renewalDate": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
    }
