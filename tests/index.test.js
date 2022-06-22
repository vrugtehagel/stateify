import { assert } from "https://deno.land/std@0.132.0/testing/asserts.ts";
import stateify from '../index.js'

const original = {
    string: 'hello world',
    number: 23,
    stringNumber: '23',
    array: ['1', '2', '3'],
    null: null,
    object: {foo: 'bar'}
}
const state = stateify(original)

Deno.test('string coercion', () => {
    assert(state.string == 'hello world')
    assert(state.array == '1,2,3')
    assert(state.number == '23')
})
Deno.test('number coercion', () => {
    assert(state.number == 23)
    assert(state.array[0] == 1)
})
Deno.test('duplication behavior', () => {
    assert(stateify(original) != state)
    assert(stateify(original.object) != state.object)
    assert(stateify(original.object).is(state.object))
})
Deno.test('single-value stateification', () => {
    const number = stateify(123)
    let calls = 0
    number.addEventListener('change', () => calls++)
    assert(number.get() == 123)
    assert(number.is(123))
    assert(number == 123)
    assert(number.typeof() == 'number')
    assert(!number.free())
    number.set(456)
    assert(number == 456)
    assert(calls == 1)
})
Deno.test('JSON stringify', () => {
    assert(JSON.stringify(original) == JSON.stringify(state))
})
Deno.test('changes affect original', () => {
    state.number = 33
    assert(original.number == 33)
    state.number = 23
})
Deno.test('.typeof()', () => {
    assert(state.string.typeof() == 'string')
    assert(state.number.typeof() == 'number')
    assert(state.null.typeof() == 'object')
    assert(state.array.typeof() == 'object')
    assert(state.object.typeof() == 'object')
})
Deno.test('.set()', () => {
    const {number} = state
    number.set(33)
    assert(state.number == 33)
    assert(original.number == 33)
    state.number = 23
})
Deno.test('.get()', () => {
    const {number, array} = state
    assert(typeof number.get() == 'number')
    assert(number.get() === 23)
    assert(Array.isArray(array.get()))
    assert(state.null.get() === null)
})
Deno.test('.delete()', () => {
    const {number} = state
    number.delete()
    assert(!('number' in state))
    number.set(23)
    assert('number' in state)
})
Deno.test('.is()', () => {
    const {number, array} = state
    assert(number.is(23))
    assert(number.is('23'))
    assert(array.is(original.array))
    assert(array.is('1,2,3'))
})
Deno.test('.free()', () => {
    const state = stateify({foo: {bar: {baz: 23}}})
    const {baz} = state.foo.bar
    assert(baz == 23)
    assert(!baz.free())
    state.foo = null
    assert(baz.is(undefined))
    assert(baz.free())
    state.foo = {bar: {baz: 44}}
    assert(baz == 44)
    assert(!baz.free())

    const {qux} = state.foo.nah.fah
    assert(qux.is(undefined))
    assert(qux.free())
    state.foo = {nah: {fah: {qux: {quux: 'abc'}}}}
    assert(!qux.free())
    assert('quux' in qux)
})
Deno.test('methods work', () => {
    assert(state.string.slice(0, 5) === 'hello')
    assert(state.number.toFixed(2) == '23.00')
    assert(state.array.at(-1) === '3')
    assert(Array.isArray(state.array.reverse()))
    assert(state.array[0] == '3')
    state.array.reverse()
})
Deno.test('change fires properly', () => {
    let calls = 0
    const state = stateify({foo: ['a', 'b', 'c']})
    state.foo.addEventListener('change', () => calls++)
    state.foo.reverse()
    assert(calls == 1)
    state.foo = [1, 2, 3]
    assert(calls == 2)
    state.foo[0] = 4
    assert(calls == 3)
})
Deno.test('change doesn\'t fire if nothing changed', () => {
    let calls = 0
    const array = ['a', 'b', 'c']
    const state = stateify({string: 'bonjour~', number: 23, array})
    state.addEventListener('change', () => calls++)
    state.string = 'bonjour~'
    state.number.set(23)
    state.array = array.reverse()
    assert(calls == 0)
})
Deno.test('change fires properly (bubbles)', () => {
    let calls = 0
    const state = stateify({foo: {bar: [{baz: 23}]}})
    state.addEventListener('change', () => calls++)
    state.foo.bar[0].baz = 44
    assert(calls == 1)
    state.foo.nah = {fah: 'abc'}
    assert(calls == 2)
    state.set(null)
    assert(calls == 3)
})
Deno.test('change fires properly (deep)', () => {
    let calls = 0
    const state = stateify({foo: {bar: [{baz: 23}]}})
    state.foo.bar[0].baz.addEventListener('change', () => calls++)
    state.foo = {}
    assert(calls == 1)
    state.foo = {fah: 'abc'}
    assert(calls == 1)
    state.set('hiya!')
    assert(calls == 1)
    state.set({foo: {bar: [{baz: 44}]}})
    assert(calls == 2)
})
Deno.test('change event detail is correct', () => {
    let calls = 0
    const original = {foo: {bar: 23}}
    const state = stateify(original)
    state.addEventListener('change', ({detail}) => {
        calls++
        const {value, oldValue, source, parent, key} = detail
        if(calls == 1){
            assert(value === original)
            assert(oldValue === original)
            assert(source === state.foo.bar)
            assert(parent === state.foo)
            assert(key === 'bar')
        }
        if(calls == 2){
            assert(value === 'bonjour~')
            assert(oldValue === original)
            assert(source === state)
            assert(parent === null)
            assert(key === null)
        }
    })
    state.foo.bar = 44
    state.set('bonjour~')
})
Deno.test('custom events are fired', () => {
    let calls = 0
    const state = stateify({foo: ['a', 'b', 'c']})
    const type = 'magic'
    state.foo.addEventListener(type, () => calls++)
    const event = new CustomEvent(type)
    state.foo.dispatchEvent(event)
    assert(calls == 1)
})
Deno.test('composed variable', () => {
    let calls = 0
    const state = stateify({
        index: 2,
        array: ['foo', 'bar', 'baz']
    })
    const composed = stateify(() => state.array[state.index])
    composed.addEventListener('change', () => calls++)
    assert(composed.is('baz'))
    state.index = 1
    assert(composed.is('bar'))
    assert(calls == 1)
    state.array[1] = 'qux'
    assert(composed.is('qux'))
    assert(calls == 2)
    state.index = 0
    assert(composed.is('foo'))
    assert(calls == 3)
    state.array[1] = 'bar'
    assert(composed.is('foo'))
    assert(calls == 3)
})
Deno.test('composed variable 2', () => {
    let calls = 0
    const state = stateify(1)
    const composed = stateify(() => state + 1)
    composed.addEventListener('change', () => calls++)
    assert(composed == 2)
    state.set(23)
    assert(composed == 24)
    assert(calls == 1)
})
Deno.test('composed variable returning plain value', () => {
    const state = stateify({
        index: 2,
        array: ['foo', 'bar', 'baz']
    })
    const composed = stateify(() => {
        const isFoo = state.array[state.index] == 'foo'
        const isBar = state.array[state.index] == 'bar'
        return !isFoo && !isBar ? null : {isFoo, isBar}
    })
    assert(composed.is(null))
    state.index = 1
    assert(!composed.isFoo.get() && composed.isBar.get())
    state.array[1] = 'qux'
    assert(composed.is(null))
    state.index = 0
    assert(composed.isFoo.get() && !composed.isBar.get())
    state.array[1] = 'bar'
    assert(composed.isFoo.get() && !composed.isBar.get())
})
Deno.test('composed variable root can be set', () => {
    let calls = 0
    const state = stateify({boolean: true})
    const composed = stateify(() => state.boolean)
    composed.addEventListener('change', () => calls++)
    assert(composed.get() === true)
    assert(calls == 0)
    composed.set(false)
    assert(calls == 1)
    assert(composed.get() === false)
    assert(state.boolean.get() == false)
    assert('boolean' in state)
    composed.delete()
    assert(calls == 2)
    assert(!('boolean' in state))
})
Deno.test('composed variable reacts to implicit changes', () => {
    let calls = 0
    const state = stateify({foo: {bar: {baz: 23}}})
    const {baz} = state.foo.bar
    const composed = stateify(() => baz.is(23))
    composed.addEventListener('change', () => calls++)
    assert(composed.is(true))
    state.foo = {}
    assert(calls == 1)
    assert(composed.is(false))
})
Deno.test('object enumeration works', () => {
    assert(Object.keys(state).length == 6)
    assert(Object.values(state).length == 6)
    assert(Object.entries(state).length == 6)
})
