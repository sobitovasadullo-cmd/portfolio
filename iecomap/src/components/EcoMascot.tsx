import React from "react";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";

interface Props {
  size?: number;
}

// EcoMap'in maskotu "Yeşilcik" — çevre temalı, sevimli bir yaprak-karakter.
// Uygulamanın sembolü: kullanıcıya bildirim ekranına girmeden önce sıcak bir
// karşılama vermek için kullanılır.
export default function EcoMascot({ size = 140 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {/* Gölge */}
      <Ellipse cx="100" cy="178" rx="46" ry="10" fill="#00000014" />

      {/* Kuyruk yaprağı */}
      <Path
        d="M60 130 C 30 120, 20 90, 40 65 C 55 85, 58 108, 60 130 Z"
        fill="#66BB6A"
      />

      {/* Gövde */}
      <Ellipse cx="100" cy="118" rx="62" ry="58" fill="#43A047" />
      <Ellipse cx="100" cy="128" rx="46" ry="34" fill="#66BB6A" />

      {/* Baş üstü filiz */}
      <Path
        d="M100 40 C 92 24, 100 10, 112 6 C 110 22, 106 34, 100 40 Z"
        fill="#2E7D32"
      />
      <Path
        d="M100 40 C 108 26, 122 20, 134 24 C 126 36, 114 42, 100 40 Z"
        fill="#2E7D32"
      />

      {/* Yanaklar */}
      <Circle cx="72" cy="126" r="9" fill="#FFAB91" opacity={0.7} />
      <Circle cx="128" cy="126" r="9" fill="#FFAB91" opacity={0.7} />

      {/* Gözler */}
      <Circle cx="82" cy="112" r="10" fill="#1B1B1B" />
      <Circle cx="118" cy="112" r="10" fill="#1B1B1B" />
      <Circle cx="85" cy="108" r="3" fill="#fff" />
      <Circle cx="121" cy="108" r="3" fill="#fff" />

      {/* Gülümseme */}
      <Path
        d="M84 138 Q100 152 116 138"
        stroke="#1B1B1B"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />

      {/* Göğüsteki geri dönüşüm rozeti */}
      <Circle cx="100" cy="150" r="14" fill="#FDD835" />
      <Path
        d="M100 143 L104 150 L96 150 Z"
        fill="#2E7D32"
      />
      <Path
        d="M94 152 L98 158 L90 158 Z"
        fill="#2E7D32"
        transform="rotate(120 96 155)"
      />
      <Path
        d="M106 152 L110 158 L102 158 Z"
        fill="#2E7D32"
        transform="rotate(-120 104 155)"
      />

      {/* Küçük eller */}
      <Circle cx="46" cy="140" r="10" fill="#43A047" />
      <Circle cx="154" cy="140" r="10" fill="#43A047" />
    </Svg>
  );
}
