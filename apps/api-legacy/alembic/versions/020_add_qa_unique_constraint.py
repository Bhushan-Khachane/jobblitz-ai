"""add unique constraint to question_answers

Revision ID: 020_qa_unique_constraint
Revises: 019_exp_years_profiles
Create Date: 2026-05-20
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "020_qa_unique_constraint"
down_revision: Union[str, None] = "019_exp_years_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_question_answers_user_question_platform",
        "question_answers",
        ["user_id", "question_text", "platform"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_question_answers_user_question_platform", "question_answers", type_="unique")
