# Tap handle (pour control): copy-paste prompts

The new strength control from `art/pour-controls.html`, option A. It is built from three sprites, each drawn at 2× in the game:

- **tap-handle.png**: the part that moves. It slides down as you pull.
- **tap-top.png**: the brass tower head at the top of the slot.
- **tap-tray.png**: the drip tray at the bottom of the slot.

The slot between the top and the tray is drawn in code (dark groove that fills with beer and foam as you pull), so it stretches to any screen height.

Make the handle first, then attach it for the other two so the brass matches. Save results in `art/new-sprites/` with the file name shown.

## tap-handle.png (13×32 px)

```
Draw a tiny pixel-art game sprite on an EXACT grid of 13 blocks wide by 32 blocks tall, shown blown up so every pixel is a big square block. Pixel art for a western saloon game. A tall beer tap handle seen from the side, standing straight up: at the top, a long carved wooden knob (about 20 blocks tall, warm brown #8a5a30 with a lighter left edge #b07a44 for the highlight and a darker right edge for shade), slightly wider at the top and tapering down, with a thin gold band (#f2b53a) across it near the top and another near the bottom. Below the knob, a short polished brass shaft (#d9a441, highlight #f6dc8f on the left) about 5 blocks wide that ends in a small brass collar at the very bottom. An outline exactly one block thick in dark brown (#1a0f0a) around the whole shape. Every block is one flat colour. No detail smaller than one block, no thin lines, no smooth shading, no gradients, no anti-aliasing, no blur, no text, at most 8 colours. Centred left to right, filling the full height. Output it blown up, filling the image, on one flat solid magenta background (#FF00FF) with nothing else in it.
```

## tap-knob.png (22×12 px): compact handle, replaces tap-handle.png

The tall handle covered the strength scale in the slot. This one sits to the LEFT of the slot and reaches in with a thin brass pin, so the colour scale stays visible above and below it.

Attach: tap-handle.png (first)

```
Draw a tiny pixel-art game sprite on an EXACT grid of 22 blocks wide by 12 blocks tall, shown blown up so every pixel is a big square block. Use the same wood and brass colours and the same outline as the FIRST attached image. Pixel art for a western saloon game. A short beer tap handle seen from the front, lying sideways: on the LEFT, a small chunky wooden knob (about 12 blocks wide and the full 12 blocks tall, warm brown #8a5a30, lighter top edge #b07a44 as the highlight, darker bottom edge as shade) with one thin gold band (#f2b53a) running down across it. From the right side of the knob, a thin straight polished brass pin (#d9a441, highlight #f6dc8f on its top edge) only 3 blocks tall sticks out horizontally to the right edge of the image, ending in a small round brass cap. The pin is centred vertically on the knob. An outline exactly one block thick in dark brown (#1a0f0a) around the whole shape. Every block is one flat colour. No detail smaller than one block, no thin lines, no smooth shading, no gradients, no anti-aliasing, no blur, no text, at most 8 colours. Output it blown up, filling the image, on one flat solid magenta background (#FF00FF) with nothing else in it.
```

## tap-top.png (25×14 px)

Attach: tap-handle.png (first)

```
Draw a tiny pixel-art game sprite on an EXACT grid of 25 blocks wide by 14 blocks tall, shown blown up so every pixel is a big square block. Use the same brass colours and outline as the FIRST attached image. Pixel art for a western saloon game. The top of a brass beer tap tower seen from the front: a rounded brass dome cap (#d9a441, highlight #f6dc8f, shade #8a6216) with a small round gold medallion in the middle stamped with a simple star, sitting on a flat brass ring. At the bottom centre, a dark opening 4 blocks wide where a handle slot continues downward. An outline exactly one block thick in dark brown (#1a0f0a). Every block is one flat colour. No detail smaller than one block, no thin lines, no smooth shading, no gradients, no anti-aliasing, no blur, no letters or numbers, at most 8 colours. Output it blown up, filling the image, on one flat solid magenta background (#FF00FF) with nothing else in it.
```

## tap-tray.png (25×14 px)

Attach: tap-handle.png (first)

```
Draw a tiny pixel-art game sprite on an EXACT grid of 25 blocks wide by 14 blocks tall, shown blown up so every pixel is a big square block. Use the same brass colours and outline as the FIRST attached image. Pixel art for a western saloon game. A small brass drip tray seen from the front, where a beer tap slot ends: at the top centre, a dark opening 4 blocks wide where the slot comes in, with a short brass spout pointing down. Below it, a shallow rectangular brass tray (#d9a441, highlight #f6dc8f, shade #8a6216) with a grid of dark holes across its top and a small puddle of golden beer with a white foam edge inside. An outline exactly one block thick in dark brown (#1a0f0a). Every block is one flat colour. No detail smaller than one block, no thin lines, no smooth shading, no gradients, no anti-aliasing, no blur, no text, at most 8 colours. Output it blown up, filling the image, on one flat solid magenta background (#FF00FF) with nothing else in it.
```
