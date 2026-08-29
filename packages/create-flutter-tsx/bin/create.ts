#!/usr/bin/env bun
import { runCreate } from '@src/index';

process.exitCode = await runCreate(process.argv.slice(2));
