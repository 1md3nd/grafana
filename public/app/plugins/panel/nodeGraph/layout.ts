import { Graphviz } from '@hpcc-js/wasm/graphviz';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUnmount } from 'react-use';
import useMountedState from 'react-use/lib/useMountedState';

import { Field } from '@grafana/data';

import { createWorker } from './createLayoutWorker';
import { EdgeDatum, EdgeDatumLayout, NodeDatum } from './types';
import { useNodeLimit } from './useNodeLimit';
import { graphBounds } from './utils';

export interface Config {
  linkDistance: number;
  linkStrength: number;
  forceX: number;
  forceXStrength: number;
  forceCollide: number;
  tick: number;
  gridLayout: boolean;
  sort?: {
    // Either a arc field or stats field
    field: Field;
    ascending: boolean;
  };
}

// Config mainly for the layout but also some other parts like current layout. The layout variables can be changed only
// if you programmatically enable the config editor (for development only) see ViewControls. These could be moved to
// panel configuration at some point (apart from gridLayout as that can be switched be user right now.).
export const defaultConfig: Config = {
  linkDistance: 150,
  linkStrength: 0.5,
  forceX: 2000,
  forceXStrength: 0.02,
  forceCollide: 100,
  tick: 300,
  gridLayout: false,
};

let graphviz: undefined | typeof Graphviz;

/**
 * This will return copy of the nods and edges with x,y positions filled in. Also the layout changes source/target props
 * in edges from string ids to actual nodes.
 */
export function useLayout(
  rawNodes: NodeDatum[],
  rawEdges: EdgeDatum[],
  config: Config = defaultConfig,
  nodeCountLimit: number,
  width: number,
  rootNodeId?: string
) {
  const [nodesGraph, setNodesGraph] = useState<NodeDatum[]>([]);
  const [edgesGraph, setEdgesGraph] = useState<EdgeDatumLayout[]>([]);

  const [loading, setLoading] = useState(false);

  const isMounted = useMountedState();
  const layoutWorkerCancelRef = useRef<(() => void) | undefined>();

  useUnmount(() => {
    if (layoutWorkerCancelRef.current) {
      layoutWorkerCancelRef.current();
    }
  });

  // Also we compute both layouts here. Grid layout should not add much time and we can more easily just cache both
  // so this should happen only once for a given response data.
  //
  // Also important note is that right now this works on all the nodes even if they are not visible. This means that
  // the node position is stable even when expanding different parts of graph. It seems like a reasonable thing but
  // implications are that:
  // - limiting visible nodes count does not have a positive perf effect
  // - graphs with high node count can seem weird (very sparse or spread out) when we show only some nodes but layout
  //   is done for thousands of nodes but we also do this only once in the graph lifecycle.
  // We could re-layout this on visible nodes change but this may need smaller visible node limit to keep the perf
  // (as we would run layout on every click) and also would be very weird without any animation to understand what is
  // happening as already visible nodes would change positions.
  useEffect(() => {
    if (rawNodes.length === 0) {
      setNodesGraph([]);
      setEdgesGraph([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    (async () => {
      if (!graphviz) {
        graphviz = await Graphviz.load();
      }
      const mappedEdges: Array<{ source: string; target: string }> = [];
      const idToDOTMap: Record<string, string> = {};
      const DOTToIdMap: Record<string, string> = {};
      let index = 0;
      for (const edge of rawEdges) {
        if (!idToDOTMap[edge.source]) {
          idToDOTMap[edge.source] = index.toString(10);
          DOTToIdMap[index.toString(10)] = edge.source;
          index++;
        }

        if (!idToDOTMap[edge.target]) {
          idToDOTMap[edge.target] = index.toString(10);
          DOTToIdMap[index.toString(10)] = edge.target;
          index++;
        }
        mappedEdges.push({ source: idToDOTMap[edge.source], target: idToDOTMap[edge.target] });
      }

      console.time('layout');
      const dot = edgesToDOT(mappedEdges);
      const dotLayout = JSON.parse(graphviz.dot(dot, 'json0'));
      // const dot = edgesToDOTNeato(mappedEdges);
      // const dotLayout = JSON.parse(graphviz.neato(dot, 'json0'));
      // const dot = edgesToDOTfdp(mappedEdges);
      // const dotLayout = JSON.parse(graphviz.fdp(dot, 'json0'));
      // const dot = edgesToDOTsfdp(mappedEdges);
      // const dotLayout = JSON.parse(graphviz.sfdp(dot, 'json0'));
      console.timeEnd('layout');

      const nodesMap: Record<string, { obj: { pos: string }; datum: NodeDatum }> = dotLayout.objects.reduce(
        (acc: Record<string, { obj: { pos: string } }>, obj: { pos: string; name: string }) => {
          acc[DOTToIdMap[obj.name]] = {
            obj,
          };
          return acc;
        },
        {}
      );

      for (const node of rawNodes) {
        nodesMap[node.id] = {
          ...nodesMap[node.id],
          datum: {
            ...node,
            x: parseFloat(nodesMap[node.id].obj.pos.split(',')[0]),
            y: parseFloat(nodesMap[node.id].obj.pos.split(',')[1]),
          },
        };
      }
      const edges: EdgeDatumLayout[] = rawEdges.map((e) => {
        return {
          ...e,
          source: nodesMap[e.source].datum,
          target: nodesMap[e.target].datum,
        };
      });

      setNodesGraph(Object.values(nodesMap).map((v) => v.datum));
      setEdgesGraph(edges);
      setLoading(false);
    })();

    // This is async but as I wanted to still run the sync grid layout, and you cannot return promise from effect so
    // having callback seems ok here.
    const cancel = defaultLayout(rawNodes, rawEdges, ({ nodes, edges }) => {
      if (isMounted()) {
        console.log({ nodes, edges });
        setNodesGraph(nodes);
        setEdgesGraph(edges);
        setLoading(false);
      }
    });
    layoutWorkerCancelRef.current = cancel;
    return cancel;
  }, [rawNodes, rawEdges, isMounted]);

  // Compute grid separately as it is sync and do not need to be inside effect. Also it is dependant on width while
  // default layout does not care and we don't want to recalculate that on panel resize.
  const [nodesGrid, edgesGrid] = useMemo(() => {
    if (rawNodes.length === 0) {
      return [[], []];
    }

    const rawNodesCopy = rawNodes.map((n) => ({ ...n }));
    const rawEdgesCopy = rawEdges.map((e) => ({ ...e }));
    gridLayout(rawNodesCopy, width, config.sort);

    return [rawNodesCopy, rawEdgesCopy as EdgeDatumLayout[]];
  }, [config.sort, rawNodes, rawEdges, width]);

  // Limit the nodes so we don't show all for performance reasons. Here we don't compute both at the same time so
  // changing the layout can trash internal memoization at the moment.
  const {
    nodes: nodesWithLimit,
    edges: edgesWithLimit,
    markers,
  } = useNodeLimit(
    config.gridLayout ? nodesGrid : nodesGraph,
    config.gridLayout ? edgesGrid : edgesGraph,
    nodeCountLimit,
    config,
    rootNodeId
  );

  // Get bounds based on current limited number of nodes.
  const bounds = useMemo(
    () => graphBounds([...nodesWithLimit, ...(markers || []).map((m) => m.node)]),
    [nodesWithLimit, markers]
  );

  return {
    nodes: nodesWithLimit,
    edges: edgesWithLimit,
    markers,
    bounds,
    hiddenNodesCount: rawNodes.length - nodesWithLimit.length,
    loading,
  };
}

/**
 * Wraps the layout code in a worker as it can take long and we don't want to block the main thread.
 * Returns a cancel function to terminate the worker.
 */
function defaultLayout(
  nodes: NodeDatum[],
  edges: EdgeDatum[],
  done: (data: { nodes: NodeDatum[]; edges: EdgeDatumLayout[] }) => void
) {
  const worker = createWorker();
  worker.onmessage = (event: MessageEvent<{ nodes: NodeDatum[]; edges: EdgeDatumLayout[] }>) => {
    for (let i = 0; i < nodes.length; i++) {
      // These stats need to be Field class but the data is stringified over the worker boundary
      event.data.nodes[i] = {
        ...nodes[i],
        ...event.data.nodes[i],
      };
    }
    done(event.data);
  };

  worker.postMessage({
    nodes: nodes.map((n) => ({
      id: n.id,
      incoming: n.incoming,
    })),
    edges,
    config: defaultConfig,
  });

  return () => {
    worker.terminate();
  };
}

/**
 * Set the nodes in simple grid layout sorted by some stat.
 */
function gridLayout(
  nodes: NodeDatum[],
  width: number,
  sort?: {
    field: Field;
    ascending: boolean;
  }
) {
  const spacingVertical = 140;
  const spacingHorizontal = 120;
  const padding = spacingHorizontal / 2;
  const perRow = Math.min(Math.floor((width - padding * 2) / spacingVertical), nodes.length);
  const midPoint = Math.floor(((perRow - 1) * spacingHorizontal) / 2);

  if (sort) {
    nodes.sort((node1, node2) => {
      const val1 = sort!.field.values.get(node1.dataFrameRowIndex);
      const val2 = sort!.field.values.get(node2.dataFrameRowIndex);

      // Let's pretend we don't care about type of the stats for a while (they can be strings)
      return sort!.ascending ? val1 - val2 : val2 - val1;
    });
  }

  for (const [index, node] of nodes.entries()) {
    const row = Math.floor(index / perRow);
    const column = index % perRow;
    node.x = column * spacingHorizontal - midPoint;
    node.y = -60 + row * spacingVertical;
  }
}

function toDOT(edges: Array<{ source: string; target: string }>, graphAttr = '', edgeAttr = '') {
  let dot = `
  digraph G {
    ${graphAttr}
  `;
  for (const edge of edges) {
    dot += edge.source + '->' + edge.target + ' ' + edgeAttr + '\n';
  }
  dot += nodesDOT(edges);
  dot += '}';
  return dot;
}

function edgesToDOT(edges: Array<{ source: string; target: string }>) {
  return toDOT(edges, '', '[ minlen=3 ]');
}

function edgesToDOTNeato(edges: Array<{ source: string; target: string }>) {
  return toDOT(edges, 'sep=1; overlap=false; mode="hier";', '[ len=1 ]');
}

function edgesToDOTfdp(edges: Array<{ source: string; target: string }>) {
  return toDOT(edges, 'sep=1;', '[ len=3 ]');
}

function edgesToDOTsfdp(edges: Array<{ source: string; target: string }>) {
  return toDOT(edges, 'overlap_scaling=40; overlap_shrink=false;');
}

function nodesDOT(edges: Array<{ source: string; target: string }>) {
  let dot = '';
  const visitedNodes = new Set();
  const attr = '[fixedsize=true, width=1.2, height=1.2] \n';
  for (const edge of edges) {
    if (!visitedNodes.has(edge.source)) {
      dot += edge.source + attr;
    }
    if (!visitedNodes.has(edge.target)) {
      dot += edge.target + attr;
    }
  }
  return dot;
}
