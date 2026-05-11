import PptxGenJS from "pptxgenjs";

export interface PptxSlide {
  background?: { color?: string };
  elements: PptxElement[];
}

export type PptxElement =
  | PptxText
  | PptxRect
  | PptxLine
  | PptxCircle;

interface PptxText {
  type: "text";
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  fontFace?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  fill?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
}

interface PptxRect {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
}

interface PptxLine {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
  width?: number;
  dash?: "solid" | "dash" | "dot";
}

interface PptxCircle {
  type: "circle";
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  borderColor?: string;
  borderWidth?: number;
}

export interface PptxLayout {
  title?: string;
  slides: PptxSlide[];
}

export async function buildPptx(layout: PptxLayout): Promise<string> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  for (const slideData of layout.slides) {
    const slide = pptx.addSlide();

    if (slideData.background?.color) {
      slide.background = { fill: slideData.background.color.replace("#", "") };
    }

    for (const el of slideData.elements) {
      switch (el.type) {
        case "text": {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const textOpts: any = {
            x: el.x,
            y: el.y,
            w: el.w,
            h: el.h,
            fontSize: el.fontSize || 12,
            fontFace: el.fontFace || "Microsoft YaHei",
            color: (el.color || "333333").replace("#", ""),
            bold: el.bold || false,
            italic: el.italic || false,
            align: el.align || "left",
            valign: el.valign || "middle",
            wrap: true,
          };
          if (el.fill) {
            textOpts.fill = { color: el.fill.replace("#", "") };
          }
          if (el.borderColor) {
            textOpts.border = {
              type: "solid",
              color: el.borderColor.replace("#", ""),
              pt: el.borderWidth || 1,
            };
          }
          if (el.borderRadius) {
            textOpts.rectRadius = el.borderRadius;
          }
          slide.addText(el.text, textOpts);
          break;
        }
        case "rect": {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rectOpts: any = {
            x: el.x,
            y: el.y,
            w: el.w,
            h: el.h,
          };
          if (el.fill) {
            rectOpts.fill = { color: el.fill.replace("#", "") };
          }
          if (el.borderColor) {
            rectOpts.border = {
              type: "solid",
              color: el.borderColor.replace("#", ""),
              pt: el.borderWidth || 1,
            };
          }
          if (el.borderRadius) {
            rectOpts.rectRadius = el.borderRadius;
          }
          slide.addShape(pptx.ShapeType.rect, rectOpts);
          break;
        }
        case "line": {
          const lineW = Math.abs(el.x2 - el.x1) || 0.01;
          const lineH = Math.abs(el.y2 - el.y1) || 0.01;
          slide.addShape(pptx.ShapeType.line, {
            x: Math.min(el.x1, el.x2),
            y: Math.min(el.y1, el.y2),
            w: lineW,
            h: lineH,
            flipV: el.y1 > el.y2,
            flipH: el.x1 > el.x2,
            line: {
              color: (el.color || "333333").replace("#", ""),
              width: el.width || 1,
              dashType: el.dash === "dash" ? "dash" : el.dash === "dot" ? "sysDot" : "solid",
            },
          });
          break;
        }
        case "circle": {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const circOpts: any = {
            x: el.x,
            y: el.y,
            w: el.w,
            h: el.h,
          };
          if (el.fill) {
            circOpts.fill = { color: el.fill.replace("#", "") };
          }
          if (el.borderColor) {
            circOpts.border = {
              type: "solid",
              color: el.borderColor.replace("#", ""),
              pt: el.borderWidth || 1,
            };
          }
          slide.addShape(pptx.ShapeType.ellipse, circOpts);
          break;
        }
      }
    }
  }

  const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return buf.toString("base64");
}
