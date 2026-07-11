import { ToolRegistry } from './registry';
import { SelectTool } from './select';
import { PointTool } from './point';
import { SegmentTool } from './segment';
import { CircleTool } from './circle';
import { PolygonTool } from './polygon';
import { ArcTool } from './arc';
import { AngleLabelTool } from './angle-label';
import { TickTool } from './tick';
import { LabelTool } from './label';

export function registerCoreTools(registry: ToolRegistry): void {
  registry.register(new SelectTool());
  registry.register(new PointTool());
  registry.register(new SegmentTool());
  registry.register(new CircleTool());
  registry.register(new PolygonTool());
  registry.register(new ArcTool());
  registry.register(new AngleLabelTool());
  registry.register(new TickTool());
  registry.register(new LabelTool());
}
