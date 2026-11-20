"""Packs the web build (dist/client) into one HTML file for a quick preview page.
Usage: python3 scripts/bundle-artifact.py <out.html>   (run `npx vite build` first)
nights.json is not inlined; publish it next to the page."""
import glob, sys
d = 'dist/client/'
css = open(glob.glob(d + 'assets/*.css')[0]).read().replace('height:100dvh', 'height:100%')
js = open(glob.glob(d + 'assets/*.js')[0]).read()
assert '</script' not in js.lower()
body = open('index.html').read().split('<body>')[1].split('<script type="module"')[0]
fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&family=Pixelify+Sans:wght@400;500;700&display=swap" rel="stylesheet">'
open(sys.argv[1], 'w').write(f'<title>Last Orders</title>\n{fonts}\n<style>\nhtml,body{{height:100%}}\n{css}\n</style>\n{body}\n<script type="module">\n{js}\n</script>\n')
print('wrote', sys.argv[1])
