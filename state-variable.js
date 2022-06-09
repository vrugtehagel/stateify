import stateify from './index.js'

export default class StateVariable extends EventTarget {
    constructor(reference){
        super()
        this.reference = reference
    }

    is(thing){ return this.reference.value == stateify.get(thing) }
    get(){ return this.reference.value }
    set(value){ return this.reference.change(() => this.reference.object[this.reference.key] = stateify.get(value)) }
    delete(){ return this.reference.change(() => delete this.reference.object[this.reference.key]) }
    free(){ return this.reference.isFree }
    typeof(){ return typeof this.reference.value }

}
