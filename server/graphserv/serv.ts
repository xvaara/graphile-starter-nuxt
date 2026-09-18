import { grafserv } from 'postgraphile/grafserv/h3/v1'
import { pgl } from './pgl'

// Share one preset, subscriber and lifecycle with direct SSR execution.
export const serv = pgl.createServ(grafserv)
