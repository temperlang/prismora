# Prismora

A cross-language color transformation library. Some intended features:

- Color formatting
- Translation between spaces like RGB, HSV, and Oklab
- Color to grayscale
- Color gradients
- Default behavior supporting human perceptual expectations

The current focus excludes opacity/alpha, but I might ought to work out a plan
for that, too.

Being made in Temper, Prismora supports the following programming languages
automatically:

- C\#
- Java
- JS
- Lua
- Python
- Hopefully more in the future as well

This library is also a testing ground for how well we can support specific
language needs. For example, it would be nice to support NumPy arrays of colors
out of the box for Python. This library might help figure out what Temper still
needs for things like that.
