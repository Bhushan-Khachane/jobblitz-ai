export type NodeAction<S> = (state: S) => S | Promise<S>;

export class StateGraph<S extends object> {
  private nodes = new Map<string, NodeAction<S>>();
  private edges = new Map<string, string>();
  private entryPoint?: string | undefined;

  addNode(name: string, action: NodeAction<S>): this {
    this.nodes.set(name, action);
    return this;
  }

  addEdge(from: string, to: string): this {
    this.edges.set(from, to);
    if (from === START) {
      this.entryPoint = to;
    }
    return this;
  }

  setEntryPoint(name: string): this {
    this.entryPoint = name;
    return this;
  }

  compile(): CompiledGraph<S> {
    let entry: string | undefined = this.entryPoint;
    if (!entry) {
      const incoming = new Set<string>();
      for (const [from, to] of this.edges) {
        if (from !== START && to !== END) {
          incoming.add(to);
        }
      }
      const candidates = Array.from(this.nodes.keys()).filter((n) => !incoming.has(n));
      if (candidates.length === 1) {
        entry = candidates[0];
      } else {
        throw new Error("No entry point set and cannot auto-detect");
      }
    }
    return new CompiledGraph<S>(this.nodes, this.edges, entry!);
  }
}

export class CompiledGraph<S extends object> {
  constructor(
    private nodes: Map<string, NodeAction<S>>,
    private edges: Map<string, string>,
    private entryPoint: string
  ) {}

  async invoke(initialState: S): Promise<S> {
    let state = { ...initialState };
    let current: string | undefined = this.entryPoint;

    while (current) {
      if (current === END) break;
      const action = this.nodes.get(current);
      if (!action) throw new Error(`Node not found: ${current}`);
      state = await action(state);
      current = this.edges.get(current);
    }

    return state;
  }
}

export const START = "__start__";
export const END = "__end__";
