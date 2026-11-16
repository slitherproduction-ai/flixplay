import { memo } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/**
 * Ícones do redesign (os mesmos do canvas aprovado e dos apps Roku, LG e
 * MSX): traço 2, viewBox 24, cantos arredondados. Um só desenho por ícone em
 * todas as plataformas — Roku usa PNGs gerados destes caminhos e a LG/MSX os
 * mesmos caminhos em `src/core/icons.js`.
 */
export type AppIconName =
  | "home"
  | "live"
  | "film"
  | "series"
  | "settings"
  | "search"
  | "bookmark"
  | "tracks"
  | "pip"
  | "heart"
  | "lock"
  | "unlock"
  | "ratio"
  | "external"
  | "back"
  | "list"
  | "globe"
  | "chevronDown"
  | "check";

type Props = {
  name: AppIconName;
  size?: number;
  color?: string;
  /** Ícone ativo (aba selecionada, favorito ligado): preenche o desenho. */
  filled?: boolean;
  strokeWidth?: number;
};

function AppIconBase({ name, size = 22, color = "#F4F8FF", filled = false, strokeWidth = 2 }: Props) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  const fill = filled ? color : "none";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      {name === "home" ? <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" {...stroke} fill={fill} /> : null}
      {name === "live" ? (
        <>
          <Rect x={3} y={7} width={18} height={13} rx={2} {...stroke} fill={fill} />
          <Path d="M8 3l4 4 4-4" {...stroke} />
        </>
      ) : null}
      {name === "film" ? (
        <>
          <Rect x={3} y={4} width={18} height={16} rx={2} {...stroke} />
          <Path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" {...stroke} />
        </>
      ) : null}
      {name === "series" ? (
        <>
          <Rect x={3} y={8} width={18} height={12} rx={2} {...stroke} fill={fill} />
          <Path d="M6 5h12M9 2h6" {...stroke} />
        </>
      ) : null}
      {name === "settings" ? (
        <>
          <Circle cx={12} cy={12} r={3.2} {...stroke} fill={fill} />
          <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" {...stroke} />
        </>
      ) : null}
      {name === "search" ? (
        <>
          <Circle cx={11} cy={11} r={7} {...stroke} />
          <Path d="M20 20l-4-4" {...stroke} />
        </>
      ) : null}
      {name === "bookmark" ? <Path d="M6 3.5h12v17l-6-4-6 4z" {...stroke} fill={fill} /> : null}
      {name === "tracks" ? (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={2.5} {...stroke} />
          <Path d="M7 12.5h4M13 12.5h4M7 15.5h7" {...stroke} />
        </>
      ) : null}
      {name === "pip" ? (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={2} {...stroke} />
          <Rect x={12} y={11} width={7} height={6} rx={1} {...stroke} fill={color} />
        </>
      ) : null}
      {name === "heart" ? <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...stroke} fill={fill} /> : null}
      {name === "lock" || name === "unlock" ? (
        <>
          <Rect x={5} y={10.5} width={14} height={10} rx={2} {...stroke} fill={fill} />
          <Path d={name === "lock" ? "M8 10.5V7.5a4 4 0 0 1 8 0v3" : "M8 10.5V7.5a4 4 0 0 1 7.6-1.8"} {...stroke} />
        </>
      ) : null}
      {name === "ratio" ? <Path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" {...stroke} /> : null}
      {name === "external" ? <Path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" {...stroke} /> : null}
      {name === "back" ? <Path d="M15 5l-7 7 7 7" {...stroke} /> : null}
      {name === "list" ? <Path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" {...stroke} /> : null}
      {/* Idioma (canvas "Idioma do aplicativo"). */}
      {name === "globe" ? (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" {...stroke} />
        </>
      ) : null}
      {name === "chevronDown" ? <Path d="M6 9l6 6 6-6" {...stroke} /> : null}
      {name === "check" ? <Path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} /> : null}
    </Svg>
  );
}

export const AppIcon = memo(AppIconBase);
