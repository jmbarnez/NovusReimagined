type PointLike = readonly number[];

/**
 * Pixi polygon paths retain point arrays by reference, so each draw needs an
 * owned buffer even when we want to recycle memory between frames.
 */
export class PixiGeometryBufferPool {
  private readonly buffers: number[][] = [];
  private cursor = 0;

  resetFrame(): void {
    this.cursor = 0;
  }

  writeRotatedScaledWorldPoints(
    points: ReadonlyArray<PointLike>,
    originX: number,
    originY: number,
    scale: number,
    cos: number,
    sin: number,
  ): number[] {
    const flatPts = this.nextBuffer(points.length * 2);
    let idx = 0;
    for (const pt of points) {
      flatPts[idx++] = (pt[0] * cos - pt[1] * sin) * scale + originX;
      flatPts[idx++] = (pt[0] * sin + pt[1] * cos) * scale + originY;
    }
    return flatPts;
  }

  writeTranslatedWorldPoints(
    points: ReadonlyArray<PointLike>,
    originX: number,
    originY: number,
  ): number[] {
    const flatPts = this.nextBuffer(points.length * 2);
    let idx = 0;
    for (const pt of points) {
      flatPts[idx++] = pt[0] + originX;
      flatPts[idx++] = pt[1] + originY;
    }
    return flatPts;
  }

  private nextBuffer(pointCount: number): number[] {
    let flatPts = this.buffers[this.cursor];
    if (!flatPts) {
      flatPts = [];
      this.buffers.push(flatPts);
    }
    this.cursor++;
    flatPts.length = pointCount;
    return flatPts;
  }
}
