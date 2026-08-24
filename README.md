# SPARTA

Project website for **SPARTA: Sparse Part-Aware Residual Transformer Adaptation for Humanoid Motion
Tracking under Actuator Failure**.

A humanoid motion-tracking framework organized around body parts, so that when an actuator fails the
policy can re-route the lost support through the trunk and the intact limbs. A whole-body tracking
expert is distilled into a part-wise latent motion prior, and a body-part Transformer then adapts
that frozen prior through explicit cross-part attention. Commands enter through a sparse five-point
interface covering the torso, wrists, and ankles.

📺 [Overview video](https://www.youtube.com/watch?v=cSsyp2lHbxI)

## Develop

This is a static site with no backend and no build step. Serve it locally with:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Serving over HTTP rather than opening `index.html` via `file://`
matches GitHub Pages behavior and avoids relative-path surprises.

## Structure

- `index.html` — all page structure and content, as Bulma `<section>` blocks.
- `static/css/index.css` — site-specific styling. `static/js/index.js` — site-specific behavior.
- `static/videos/` — result clips, organized per topic.
- Everything else under `static/css` and `static/js` is vendored (Bulma, carousel, slider,
  Font Awesome). Do not edit or reformat those files.

The full-length demo video is hosted on YouTube rather than committed, since it exceeds GitHub's
100 MB file limit.

## Citation

```
@article{ji2027sparta,
  author    = {Ji, Ziteng and Hong, Chuye and Shao, Yiyang and Sreenath, Koushil},
  title     = {{SPARTA}: Sparse Part-Aware Residual Transformer Adaptation for Humanoid Motion Tracking under Actuator Failure},
  journal   = {In-submission},
  year      = {2027},
}
```

## Website License

Page template borrowed from [Nerfies](https://nerfies.github.io).

<a rel="license" href="http://creativecommons.org/licenses/by-sa/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-sa/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-sa/4.0/">Creative Commons Attribution-ShareAlike 4.0 International License</a>.
