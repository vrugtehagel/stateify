import composed from './composed.js'
import Reference from './reference.js'

export default function stateify(thing){
    thing = stateify.get(thing)
    if(typeof thing == 'function') return composed(thing)
    const base = {value: {_: thing}}
    const {proxy} = new Reference(base, '_', true)
    return proxy
}

stateify.get = value => value?.[Reference.symbol] ? value.get() : value
stateify.made = value => !!value?.[Reference.symbol]
stateify.typeof = value => typeof stateify.get(value)



