#!/usr/bin/env node

import { Context } from '@monolith/cordis'
import { pathToFileURL } from 'node:url'
import Loader from '@monolith/cordis-plugin-loader'

const ctx = new Context()
ctx.baseUrl = pathToFileURL(process.cwd()).href + '/'

await ctx.plugin(Loader)
await ctx.loader.create({
  name: '@monolith/cordis-plugin-include',
  config: {
    path: './cordis.yml',
  },
})
