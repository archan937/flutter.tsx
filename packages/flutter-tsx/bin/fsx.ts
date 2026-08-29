#!/usr/bin/env bun
import { runCli } from '@src/cli/run';

process.exitCode = await runCli(process.argv.slice(2));
