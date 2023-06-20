#!/bin/sh -e
set -x

ruff check --fix backend
black backend
