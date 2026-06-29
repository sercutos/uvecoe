import React from 'react';

// LOGO OSCURO (Utiliza un Data URI de tu SVG real para garantizar el renderizado)
export function LogoOscuro({ width = "160px", ...props }) {
  // Tu SVG real codificado en String seguro
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 160">
      <path d="M40,60 L40,110 C40,125 50,135 65,135 C80,135 90,125 90,110 L90,60" fill="none" stroke="#757575" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M105,60 L125,135 L145,60" fill="none" stroke="#757575" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M225,100 L170,100 C170,115 180,125 195,125 C210,125 218,115 220,105 M222,90 C220,75 210,65 195,65 C180,65 170,75 170,95" fill="none" stroke="#000000" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M285,75 C280,65 270,65 260,65 C245,65 235,78 235,98 C235,118 245,130 260,130 C272,130 282,122 285,110" fill="none" stroke="#000000" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="305" y="52" width="76" height="82" rx="22" ry="22" fill="none" stroke="#000000" stroke-width="20" />
      <path d="M455,100 L400,100 C400,115 410,125 425,125 C440,125 448,115 450,105 M452,90 C450,75 440,65 425,65 C410,65 400,75 400,95" fill="none" stroke="#000000" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M343,12 L343,32" stroke="#000000" stroke-width="10" stroke-linecap="round" />
      <path d="M312,21 L326,35" stroke="#000000" stroke-width="9" stroke-linecap="round" />
      <path d="M374,21 L360,35" stroke="#000000" stroke-width="9" stroke-linecap="round" />
    </svg>
  `;

  const src = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

  return (
    <img 
      src={src} 
      alt="Logo UVECOE" 
      style={{ width: width, height: "auto", display: "block" }} 
      {...props} 
    />
  );
}

// LOGO BLANCO
export function LogoBlanco({ width = "160px", ...props }) {
  const svgString = `
    <svg viewBox="0 0 540 160" style={{ width: "190px", height: "auto", display: "block" }}>
      {/* Letras "uv" - Gris corporativo, finas y estilizadas */}
      <path d="M35,55 L35,100 C35,112 43,120 55,120 C67,120 75,112 75,100 L75,55" fill="none" stroke="#757575" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M87,55 L102,120 L117,55" fill="none" stroke="#757575" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Letra "e" - Negra, compacta y con curvas unidas al píxel */}
      <path d="M182,90 L132,90 C132,104 141,114 156,114 C168,114 175,106 177,98 M178,82 C175,68 166,58 154,58 C140,58 131,68 131,88" fill="none" stroke="#000000" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Letra "c" - Perfectamente acoplada a la "e" */}
      <path d="M232,70 C228,60 219,58 210,58 C196,58 187,70 187,89 C187,108 196,119 210,119 C221,119 229,112 232,102" fill="none" stroke="#000000" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* La "o" icónica - Caja cuadrada con esquinas muy redondeadas */}
      <rect x="250" y="50" width="74" height="74" rx="24" ry="24" fill="none" stroke="#000000" strokeWidth="18" />
      
      {/* Letra "e" final */}
      <path d="M388,90 L338,90 C338,104 347,114 362,114 C374,114 381,106 383,98 M384,82 C381,68 372,58 360,58 C346,58 337,68 337,88" fill="none" stroke="#000000" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Los 3 destellos característicos sobre la "o" */}
      <path d="M 287 10 L 287 28" stroke="#000000" strokeWidth="9" strokeLinecap="round" />
      <path d="M 258 18 L 271 30" stroke="#000000" strokeWidth="9" strokeLinecap="round" />
      <path d="M 316 18 L 303 30" stroke="#000000" strokeWidth="9" strokeLinecap="round" />
    </svg>
  `;

  const src = `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;

  return (
    <img 
      src={src} 
      alt="Logo UVECOE Blanco" 
      style={{ width: width, height: "auto", display: "block" }} 
      {...props} 
    />
  );
}