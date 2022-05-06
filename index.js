const isStateVariableSymbol = Symbol()
const roots = new WeakMap()
let tracking

function track(callback, value){
    tracking = new Set
    const result = callback()
    value.set(result)
    if(result?.[isStateVariableSymbol]) tracking.add(result)
    const controller = new AbortController()
    const {signal} = controller
    const onchange = () => {
        controller.abort()
        track(callback, value)
    }
    for(const variable of tracking)
        variable.addEventListener?.('change', onchange, {signal})
    tracking = null
    return value
}

export default function stateify(thing){
    if(typeof thing == 'function') return track(thing, stateify({}).value)
    if(thing != null && thing[isStateVariableSymbol])
        thing = thing.get()
    if(roots.has(thing)) return roots.get(thing)
    const root = {_: thing}
    const reference = new PropertyReference(root, '_')
    const result = reference.proxy
    if(thing && typeof thing == 'object') roots.set(thing, result)
    return result
}

class PropertyReference extends EventTarget {
    static map = new WeakMap()
    static parentMap = new WeakMap()
    object
    key
    callback
    specials = {
        valueOf: () => this.value,
        toString: () => this.value.toString(),
        toJSON: () => this.isObject ? this.value : JSON.stringify(this.value),
        get: () => this.value,
        set: value => {
            if(value?.[isStateVariableSymbol]) value = value.get()
            this.change(() => this.object[this.key] = value)
        },
        is: thing => {
            return thing?.[isStateVariableSymbol]
                ? this.value == thing.get()
                : this.value == thing
        },
        delete: () => this.change(() => delete this.object[this.key]),
        typeof: () => typeof this.value,
        addEventListener: (...args) => this.addEventListener(...args),
        removeEventListener: (...args) => this.removeEventListener(...args),
        dispatchEvent: (...args) => this.dispatchEvent(...args)
    }

    constructor(object, key, callback = null){
        if(!PropertyReference.map.has(object))
            PropertyReference.map.set(object, {})
        const cache = PropertyReference.map.get(object)
        if(cache[key]) return cache[key]
        super()
        Object.assign(this, {object, key, callback})
        cache[key] = this
        this.initialize()
        this.changeValue(this.value)
    }

    get value(){ return this.object[this.key] }
    get isObject(){ return typeof this.value == 'object' && this.value != null }
    get isArray(){ return Array.isArray(this.value) }

    change(callback){
        const oldValue = this.value
        callback()
        const {value, key} = this
        this.changeValue(value, oldValue)
        this.dispatchValueChange(value, oldValue)
        PropertyReference.parentMap.get(this.object)
            ?.forEach(reference => reference.dispatchPropertyChange(key))
    }

    dispatchValueChange(value, oldValue){
        if(value === oldValue) return
        const detail = {oldValue, value}
        this.dispatchEvent(new CustomEvent('valuechange', {detail}))
        this.dispatchEvent(new CustomEvent('change', {detail}))
    }

    dispatchPropertyChange(property){
        const detail = property == null ? {unknown: true} : {property}
        this.dispatchEvent(new CustomEvent('propertychange', {detail}))
        this.dispatchEvent(new CustomEvent('change', {detail}))
    }

    changeValue(newValue, oldValue){
        PropertyReference.parentMap.get(oldValue)?.delete(this)
        if(!this.isObject) return
        if(typeof newValue != 'object' || newValue == null) return
        if(!PropertyReference.parentMap.has(newValue))
            PropertyReference.parentMap.set(newValue, new Set())
        PropertyReference.parentMap.get(newValue).add(this)
    }

    isPropertyReference(property){
        if(!this.isObject) return false
        if(!this.isArray) return true
        if(typeof property == 'symbol') return false
        if(Number.isInteger(+property) && property >= 0) return true
        return false
    }

    initialize(){
        const source = this.callback ?? {}
        const custom = {}
        custom.get = (source, property) => this.get(property)
        custom.set = (source, property, value) => {
            if(!this.isPropertyReference(property)) return true
            this.proxy[property].set(value)
            return true
        }
        custom.deleteProperty = (source, property) => {
            if(!this.isPropertyReference(property)) return
            this.proxy[property].delete()
            return true
        }
        custom.apply = (source, ...args) => this.callback.apply(...args)
        const get = (source, property) => custom[property] ??
            ((source, ...args) => Reflect[property](this.value, ...args))
        const handler = new Proxy(custom, {get})
        this.proxy = new Proxy(source, handler)
    }

    get(property){
        if(property == isStateVariableSymbol) return true
        if(!this.isObject && property == Symbol.toPrimitive)
            return () => this.value
        const callback = this.specials[property]
        if((!this.isObject || this.isArray) && callback) return callback
        const value = this.getFlattenedValue(property)
        if(!this.isPropertyReference(property)) return value
        const object = this.value
        const {proxy} = new PropertyReference(object, property, callback)
        tracking?.add(proxy)
        return proxy
    }

    getFlattenedValue(property){
        const value = this.value[property]
        if(typeof value != 'function') return value
        if(!this.isArray) return value.bind(this.value)
        return (...args) =>
            this.callArrayMethod(this.value, property, ...args)
    }

    callArrayMethod(array, property, ...args){
        const before = [...array]
        const after = array
        const result = array[property](...args)
        const hasChanged = before.length != after.length
            || after.some((element, index) => element !== before[index])
        if(!hasChanged) return result
        const length = Math.max(before.length, after.length)
        const changes = []
        for(let index = 0; index < length; index++)
            if(after[index] !== before[index]) changes.push(index)
        for(const index of changes)
            this.changeValue(after[index], before[index])
        const references = PropertyReference.map.get(array)
        for(const index of changes)
            references?.[index]?.dispatchValueChange(after[index], before[index])
        PropertyReference.parentMap.get(array)
            ?.forEach(reference => reference.dispatchPropertyChange())
        return result
    }

}
