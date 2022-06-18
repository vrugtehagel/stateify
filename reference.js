import StateVariable from './state-variable.js'
import isSame from './is-same.js'
import stateify from './index.js'
import composed from './composed.js'

export default class Reference {
    static symbol = Symbol()
    static roots = new Map
    static children = new WeakMap
    cache

    stateVariable = new StateVariable(this)

    constructor(parent, key, isRoot = false){
        const cache = Reference.children.get(parent)
        const reference = cache?.[key]
        if(reference) return reference
        if(cache) cache[key] = this
        else Reference.children.set(parent, {[key]: this})
        if(isRoot) Reference.roots.set(this, new Set([this]))
        else Reference.roots.get(parent.root).add(this)
        this.parent = parent
        this.key = key
        this.isRoot = isRoot
        this.root = isRoot ? this : parent.root
        this.proxy = new Proxy(() => {}, this)
        this.cache = this.value
    }

    get object(){ return this.parent.value }
    get value(){ return this.object?.[this.key] }
    get isObject(){ const {value} = this; return value && typeof value == 'object' }
    get isFree(){ return !this.isRoot && !this.parent.isObject }

    get(target, key){
        if(key == Reference.symbol) return this
        if(key == Symbol.toPrimitive)
            return this.isObject ? undefined : () => this.value
        if(key == 'valueOf') return () => this.value
        if(key == 'toJSON') return () => this.value
        if(key == 'toString') return () => this.value.toString()
        const {proxy} = new Reference(this, key)
        composed.tracking?.add(proxy)
        return proxy
    }

    set(target, key, value){
        this.proxy[key].set(value)
        return true
    }

    deleteProperty(target, key){
        this.proxy[key].delete()
        return true
    }

    apply(target, thisArg, args){
        const {object, key} = this
        if(key in this.stateVariable)
            return this.parent.stateVariable[key](...args)
        if(!this.parent.isRoot && !this.parent.isObject)
            return this.object[key](...args)
        const oldObject = {...this.object}
        const result = this.object[key](...args)
        const newObject = this.object
        const keys = new Set(Object.keys(newObject))
        for(const key of Object.keys(oldObject)) keys.add(key)
        for(const key of keys){
            if(isSame(oldObject[key], newObject[key])) continue
            this.parent.dispatchChange()
            break
        }
        return result
    }

    ownKeys(target){
        return this.isObject ? Object.keys(this.value) : []
    }

    has(target, key){
        return this.isObject && key in this.value
    }

    getPrototypeOf(target){
        return this.stateVariable
    }

    getOwnPropertyDescriptor(target, key){
        if(!this.isObject) return
        return {configurable: true, enumerable: true}
    }

    change(callback){
        callback()
        const change = this.getChange()
        this.dispatchChange(change)
    }

    getInfo(){
        const parent = this.parent?.proxy ?? null
        const key = this.isRoot ? null : this.key
        const source = this.proxy
        return {parent, key, source}
    }

    getChange(){
        const value = this.value
        const oldValue = this.cache
        this.cache = value
        return {value, oldValue}
    }

    dispatchChange(change, info){
        if(change && change.oldValue === change.value) return
        const single = Boolean(info)
        info ??= this.getInfo()
        change ??= this.getChange()
        const detail = {...info, ...change}
        this.stateVariable.dispatchEvent(new CustomEvent('change', {detail}))
        if(single) return
        const references = new Set(Reference.roots.get(this.root))
        const changes = new Map
        const all = new Set
        for(const reference of references){
            const change = reference.getChange()
            if(change.oldValue !== change.value || reference == this)
                changes.set(reference, change)
            else continue
            let current = reference
            while(!current.isRoot){
                all.add(current)
                current = current.parent
            }
        }
        all.add(this.root)
        for(const reference of all){
            if(reference == this) continue
            const change = changes.get(reference)
            reference.dispatchChange(change, info)
        }
    }

}
