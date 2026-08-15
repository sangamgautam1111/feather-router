export function FeatherGraphic() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full overflow-visible"
      fill="none"
      viewBox="0 0 560 620"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="feather-stroke" x1="120" x2="455" y1="480" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="0.5" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient id="feather-fill" x1="185" x2="440" y1="440" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0EA5E9" stopOpacity="0.12" />
          <stop offset="1" stopColor="#8B5CF6" stopOpacity="0.22" />
        </linearGradient>
        <filter id="feather-glow" height="170%" width="170%" x="-35%" y="-35%">
          <feGaussianBlur result="blur" stdDeviation="7" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <pattern id="circuit" height="42" patternUnits="userSpaceOnUse" width="42">
          <path d="M0 21H16L21 16H42M21 0V16" stroke="#67E8F9" strokeOpacity=".2" strokeWidth="1" />
          <circle cx="21" cy="16" fill="#67E8F9" fillOpacity=".45" r="1.5" />
        </pattern>
      </defs>
      <path d="M152 505C225 391 303 236 439 77C402 233 358 386 152 505Z" fill="url(#feather-fill)" />
      <path d="M152 505C245 390 332 197 439 77" filter="url(#feather-glow)" stroke="url(#feather-stroke)" strokeLinecap="round" strokeWidth="6" />
      <path d="M184 454C173 355 213 212 390 111M202 422C214 319 285 198 417 102M222 388C267 300 338 199 431 95M244 351C315 299 374 216 438 93M272 309C335 275 389 200 439 90" stroke="url(#feather-stroke)" strokeLinecap="round" strokeOpacity=".78" strokeWidth="2" />
      <path d="M171 469C250 470 362 389 434 103M192 437C279 419 378 331 438 94M215 403C290 368 379 280 441 87M245 363C307 330 380 242 441 84M280 316C330 284 387 192 443 81" stroke="url(#feather-stroke)" strokeLinecap="round" strokeOpacity=".68" strokeWidth="2" />
      <path d="M190 448C255 379 347 245 425 112M217 412C273 347 350 237 433 101M248 367C305 306 373 201 439 87" stroke="#C4B5FD" strokeLinecap="round" strokeOpacity=".55" strokeWidth="1.2" />
      <path d="M175 480C263 428 356 273 436 91" stroke="url(#circuit)" strokeOpacity=".8" strokeWidth="45" />
      {[[180, 467], [211, 424], [247, 379], [291, 315], [334, 250], [376, 185], [414, 122], [285, 340], [331, 287], [366, 235]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} fill="#A5F3FC" r="3" />
      ))}
    </svg>
  );
}
