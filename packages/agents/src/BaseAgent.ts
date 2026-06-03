export abstract class BaseAgent<I, O> {
  abstract readonly name: string;
  abstract readonly model: string;

  protected abstract run(input: I): Promise<O>;

  protected abstract fallbackResult(input: I): O;

  protected onSuccess?(_input: I, _output: O, _latencyMs: number): void;
  protected onError?(_input: I, _err: unknown, _latencyMs: number): void;

  async execute(input: I): Promise<O> {
    const label = `${this.name}.run`;
    console.time(label);
    const start = performance.now();

    try {
      const result = await this.run(input);
      const latency = Math.round(performance.now() - start);
      console.timeEnd(label);
      this.onSuccess?.(input, result, latency);
      return result;
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      console.timeEnd(label);
      console.error(`[${label}] error:`, err);
      this.onError?.(input, err, latency);
      return this.fallbackResult(input);
    }
  }
}
