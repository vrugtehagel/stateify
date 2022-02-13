const isStateVariableSymbol = Symbol('is-state-variable')

export default function(thing){
    if(thing != null && thing[isStateVariableSymbol])
        thing = thing.get()
    const root = {thing}
    const reference = new PropertyReference(root, 'thing')
    return reference.proxy
}

class PropertyReference extends EventTarget {
    static map = new WeakMap()
    static parentMap = new WeakMap()
    static proxyActions = [
        'apply',
        'construct',
        'defineProperty',
        'deleteProperty',
        'get',
        'getOwnPropertyDescriptor',
        'getPrototypeOf',
        'has',
        'isExtensible',
        'ownKeys',
        'preventExtensions',
        'set',
        'setPrototypeOf'
    ]
    object
    key
    callback
    specials = {
        valueOf: () => this.value,
        toString: () => this.value.toString(),
        get: () => this.value,
        set: value => {
            if(value != null && value[isStateVariableSymbol])
                value = value.get()
            this.change(() => this.object[this.key] = value)
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
        const source = this.callback ? function(){} : {}
        const handler = {}
        handler.get = (source, property) =>
            this.get(property)
        handler.set = (source, property, value) => {
            if(!this.isPropertyReference(property)) return true
            this.proxy[property].set(value)
            return true
        }
        handler.deleteProperty = (source, property) => {
            if(!this.isPropertyReference(property)) return
            this.proxy[property].delete()
        }
        handler.apply = (source, thisArg, ...args) =>
            this.callback.apply(thisArg, ...args)
        for(const action of PropertyReference.proxyActions)
            handler[action] ??= (source, ...args) =>
                Reflect[action](this.value, ...args)
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
        const reference = new PropertyReference(object, property, callback)
        return reference.proxy
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
