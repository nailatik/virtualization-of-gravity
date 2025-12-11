declare module 'react-force-graph' {
  import type { FC } from 'react';
  
  export interface GraphData {
    nodes: any[];
    links: any[];
  }
  
  export interface ForceGraph2DProps {
    graphData: GraphData;
    nodeId?: string;
    nodeLabel?: string;
    nodeVal?: (node: any) => number;
    nodeColor?: (node: any) => string;
    linkDistance?: number;
    d3Force?: any;
    onNodeClick?: (node: any) => void;
    onNodeDragEnd?: (node: any) => void;
    width?: number;
    height?: number;
    backgroundColor?: string;
  }
  
  export const ForceGraph2D: FC<ForceGraph2DProps>;
  export const ForceGraph3D: FC<any>;
}
