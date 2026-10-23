// Logo, colors and fonts mirror andrey-markin.com so the bucket reads as part of the site.
export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>:root{--ink:#1375a0;--accent:#35794b}@media (prefers-color-scheme:dark){:root{--ink:#47d1cd;--accent:#72cf8e}}</style><rect x="7.006" y="13.291" width="10.56" height="10.56" rx="6.286" fill="var(--ink)"/><rect x="19.577" y="25.863" width="10.56" height="10.56" rx="6.286" fill="var(--ink)"/><rect x="32.149" y="38.434" width="10.56" height="10.56" rx="6.286" fill="var(--ink)"/><rect x="19.577" y="51.006" width="10.56" height="10.56" rx="6.286" fill="var(--ink)"/><rect x="7.006" y="63.577" width="10.56" height="10.56" rx="6.286" fill="var(--ink)"/><rect x="57.291" y="76.149" width="10.56" height="10.56" rx="6.286" fill="var(--accent)"/><rect x="69.863" y="76.149" width="10.56" height="10.56" rx="6.286" fill="var(--accent)"/><rect x="82.434" y="76.149" width="10.56" height="10.56" rx="6.286" fill="var(--accent)"/></svg>`;

const SITE = "https://andrey-markin.com";

export const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Andrey's share bucket</title>
<meta name="description" content="Demos, screenshots and experiments shared by Andrey Markin.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,500;1,500&family=Space+Grotesk:wght@400;500&display=swap" rel="stylesheet">
<style>
:root {
  --background: oklch(0.9696 0 0);
  --foreground: oklch(0.148 0.004 228.8);
  --card: oklch(0.96 0.008 152);
  --primary: oklch(0.5311 0.1062 234.34);
  --secondary: oklch(0.955 0.045 152);
  --secondary-foreground: oklch(0.24 0.022 152);
  --muted-foreground: oklch(0.56 0.021 213.5);
  --border: oklch(0.5311 0.1062 234.34 / 0.2);
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: oklch(0.1457 0 0);
    --foreground: oklch(0.92 0 0);
    --card: oklch(0.178 0.009 152);
    --primary: oklch(0.7869 0.1165 192.26);
    --secondary: oklch(0.305 0.042 152);
    --secondary-foreground: oklch(0.965 0.012 152);
    --muted-foreground: oklch(0.708 0.015 210);
    --border: oklch(0.7869 0.1165 192.26 / 0.2);
  }
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  display: grid;
  place-items: center;
  padding: 2rem;
  background: var(--background);
  color: var(--foreground);
  font: 400 1rem/1.6 "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
}
main {
  width: min(34rem, 100%);
  padding: 2.5rem;
  border: 1px solid var(--border);
  border-radius: 1.5rem;
  background: var(--card);
}
.logo { width: 3rem; height: 3rem; display: block; margin-bottom: 1.75rem; }
.badge {
  display: inline-block;
  padding: 0.15rem 0.7rem;
  border-radius: 999px;
  background: var(--secondary);
  color: var(--secondary-foreground);
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}
h1 {
  margin: 0.9rem 0 0.6rem;
  font: 500 clamp(2.2rem, 7vw, 3rem)/1.05 "EB Garamond", Georgia, serif;
  letter-spacing: -0.01em;
}
h1 em { color: var(--primary); }
p { margin: 0 0 1.75rem; color: var(--muted-foreground); }
a.site {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.15rem;
  border-radius: 999px;
  background: var(--primary);
  color: var(--background);
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.15s;
}
a.site:hover { opacity: 0.85; }
</style>
</head>
<body>
<main>
  <img class="logo" src="/favicon.svg" alt="">
  <span class="badge">share.mark-life.com</span>
  <h1>Andrey's <em>share</em> bucket</h1>
  <p>Demos, screenshots and product experiments, published straight from my agents. Links here are unlisted: you got one because someone sent it to you.</p>
  <a class="site" href="${SITE}">andrey-markin.com <span aria-hidden="true">&rarr;</span></a>
</main>
</body>
</html>`;
