#!/bin/sh -e
set -x

black src
ruff check --fix
