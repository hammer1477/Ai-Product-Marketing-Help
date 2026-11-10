import type { DesignLayer, DesignSchema } from "../types";
import { ICON_REGISTRY, isKnownIconKey } from "./icons";

function textAlignToJustify(textAlign: "left" | "center" | "right") {
  if (textAlign === "center") return "center";
  if (textAlign === "right") return "flex-end";
  return "flex-start";
}

function renderLayer(layer: DesignLayer) {
  const positioning: React.CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    opacity: layer.opacity ?? 1,
    transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
  };

  switch (layer.type) {
    case "text": {
      // Clamping is what makes "no overlapping text" a structural
      // guarantee rather than a hope. Templates position the next block
      // using a *measured* height, and measurement is an approximation of
      // what the renderer will do — so without a hard cap, a wrap the
      // estimate didn't predict spills straight through the block below.
      // With the clamp, the layer physically cannot render taller than the
      // line budget it was measured against.
      const clamp = layer.maxLines
        ? ({
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: layer.maxLines,
            overflow: "hidden",
          } as React.CSSProperties)
        : ({
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: textAlignToJustify(layer.textAlign),
          } as React.CSSProperties);

      return (
        <div
          key={layer.id}
          style={{
            ...positioning,
            ...clamp,
            fontFamily: layer.fontFamily,
            fontSize: layer.fontSize,
            fontWeight: layer.fontWeight,
            color: layer.color,
            textAlign: layer.textAlign,
            lineHeight: layer.lineHeight ?? 1.2,
            letterSpacing: layer.letterSpacing,
          }}
        >
          {layer.content}
        </div>
      );
    }

    case "image":
      return (
        <img
          key={layer.id}
          src={layer.src}
          width={layer.width}
          height={layer.height}
          style={{
            ...positioning,
            objectFit: layer.fit,
            borderRadius: layer.borderRadius ?? 0,
          }}
        />
      );

    case "icon": {
      const key = isKnownIconKey(layer.iconKey) ? layer.iconKey : "star";
      const Icon = ICON_REGISTRY[key];
      const size = Math.min(layer.width, layer.height);
      return (
        <div
          key={layer.id}
          style={{ ...positioning, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Icon color={layer.color} size={size} />
        </div>
      );
    }

    case "shape": {
      const borderRadius =
        layer.shape === "ellipse"
          ? "50%"
          : layer.shape === "badge"
            ? Math.min(layer.width, layer.height) / 2
            : layer.borderRadius ?? 0;
      return (
        <div
          key={layer.id}
          style={{
            ...positioning,
            display: "flex",
            backgroundColor: layer.fill,
            border: layer.stroke ? `${layer.strokeWidth ?? 1}px solid ${layer.stroke}` : undefined,
            borderRadius,
          }}
        />
      );
    }

    default:
      return null;
  }
}

export function renderSchemaToSatoriTree(schema: DesignSchema) {
  const sortedLayers = [...schema.layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      style={{
        width: schema.canvas.width,
        height: schema.canvas.height,
        backgroundColor: schema.canvas.backgroundColor,
        position: "relative",
        display: "flex",
      }}
    >
      {sortedLayers.map(renderLayer)}
    </div>
  );
}
