import { grafserv } from 'postgraphile/grafserv/h3/v1'
import { pgl } from './pgl'

export const serv = pgl.createServ(grafserv)
