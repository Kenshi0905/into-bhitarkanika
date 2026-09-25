// Designed waterway, in metres. Shared by terrain, navigation, and hull collisions.
export const center = z => 22*Math.sin(z*.008)+11*Math.sin(z*.021);
export const width = z => 29+5*Math.sin(z*.011+1)+3*Math.sin(z*.028);
