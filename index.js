const getReference = Symbol()
const propagationStopped = Symbol()
let tracking

function track(callback, value){
    tracking = new Set
    const result = callback()
    const dependencies = tracking
    tracking = null
    const controller = new AbortController
    const {signal} = controller
    const onchange = () => {
        controller.abort()
        track(callback, value)
    }
    for(const dependency of dependencies)
        dependency.addEventListener('change', onchange, {signal})
    value.set(result)
    return value
}

export default function stateify(thing){
    if(typeof thing == 'function') return track(thing, stateify({})._)
    thing = stateify.get(thing)
    const root = {isObject: true, isRoot: true, value: {_: thing}}
    const reference = new PropertyReference(root, '_')
    const {proxy} = reference
    proxy.set(thing)
    return proxy
}

stateify.get = value => value?.[getReference]?.value ?? value
stateify.test = value => !!value?.[getReference]

class PropertyReference {
    static children = new WeakMap()
    target = new EventTarget

    specials = {
        toJSON: () => this.value,
        is: thing => this.value == stateify.get(thing),
        get: () => this.value,
        set: value => this.change(() => this.object[this.key] = stateify.get(value)),
        delete: () => this.change(() => delete this.object?.[this.key]),
        free: () => this.isEmpty,
        typeof: () => typeof this.value,
        addEventListener: (...args) => this.target.addEventListener(...args),
        removeEventListener: (...args) => this.target.removeEventListener(...args),
        dispatchEvent: (...args) => this.target.dispatchEvent(...args)
    }

    constructor(parent, key){
        const cache = PropertyReference.children.get(parent)
        const reference = cache?.[key]
        if(reference) return reference
        if(cache) cache[key] = this
        else PropertyReference.children.set(parent, {[key]: this})
        this.parent = parent
        this.key = key
        const custom = {}
        custom.get = (source, key) => this.get(key)
        custom.set = (source, key, value) => this.proxy[key].set(value)
        custom.deleteProperty = (source, key) => this.proxy[key].delete()
        custom.apply = (source, ...args) => this.callback.apply(...args)
        const get = (source, key) => custom[key] ??
            ((source, ...args) => Reflect.has(this.value, ...args))
        const handler = new Proxy(custom, {get})
        this.proxy = new Proxy(function(){}, handler)
    }

    get callback(){ return this.parent.getCallback?.(this.key) }
    get object(){ return this.parent.value }
    get value(){ return this.object?.[this.key] }
    get isEmpty(){ return !this.parent.isObject }
    get isObject(){ return typeof this.value == 'object' && this.value != null }
    get isArray(){ return Array.isArray(this.value) }
    get detail(){
        const source = this.proxy
        const key = this.parent.isRoot ? null : this.key
        const parent = this.parent?.proxy ?? null
        const stopPropagation = function(){ this[propagationStopped] = true }
        return {source, key, parent, stopPropagation}
    }

    change(callback){
        const oldValue = this.value
        callback()
        const {value, key} = this
        this.dispatchChange(value, oldValue, this.detail)
        return true
    }

    dispatchChange(value, oldValue, data){
        if(value === oldValue) return
        const stopPropagation = !data
        data ??= this.detail
        const detail = {value, oldValue, ...data}
        this.target.dispatchEvent(new CustomEvent('change', {detail}))
        if(stopPropagation || detail[propagationStopped]) return
        this.parent.dispatchChange?.(value, oldValue, data)
    }

    get(key){
        if(key == getReference) return this
        if(key == Symbol.toPrimitive)
            return this.isObject ? undefined : () => this.value
        if(key == 'valueOf') return () => this.value
        if(key == 'toString') return () => this.value.toString()
        const {proxy} = new PropertyReference(this, key)
        tracking?.add(proxy)
        return proxy
    }

    getCallback(key){
        if(this.specials[key]) return this.specials[key]
        if(typeof this.value[key] != 'function') return
        if(!this.isArray) return this.value[key].bind(this.value)
        return (...args) => this.callArrayMethod(this.value, key, args)
    }

    isPropertyReference(key){
        if(this.isEmpty) return false
        if(!this.isObject) return false
        if(!this.isArray) return true
        if(typeof key == 'symbol') return false
        if(key < 0) return false
        if(Number.isInteger(+key)) return true
        return false
    }

    callArrayMethod(array, method, args){
        const before = [...array]
        const after = array
        const result = array[method](...args)
        const hasChanged = before.length != after.length
            || after.some((element, index) => element !== before[index])
        if(!hasChanged) return result
        const length = Math.max(before.length, after.length)
        const changes = []
        for(let index = 0; index < length; index++)
            if(after[index] !== before[index]) changes.push(index)
        const last = changes.pop()
        const {proxy, detail} = this
        for(const index of changes)
            proxy[index][getReference].dispatchChange(after[index], before[index])
        proxy[last][getReference].dispatchChange(after[last], before[last], detail)
        return result
    }
}
