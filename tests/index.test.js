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
Deno.test('non-duplication behavior', () => {
    assert(stateify(original) == state)
    assert(stateify(original.object) != state.object)
    assert(stateify(original.object).is(state.object))
})
Deno.test('JSON stringify', () => {
    assert(JSON.stringify(original) == JSON.stringify(state))
})
Deno.test('changes to state variable changes original', () => {
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
Deno.test('valuechange fires properly', () => {
    let calls = 0
    const state = stateify({foo: ['a', 'b', 'c']})
    state.foo.addEventListener('valuechange', event => {
        const {value, oldValue} = event.detail
        calls++
        assert(value == '1,2,3')
        assert(oldValue == 'A,b,a')
    })
    state.foo.reverse()
    state.foo[0] = 'A'
    assert(calls == 0)
    state.foo = [1, 2, 3]
    assert(calls == 1)
})
Deno.test('propertychange fires properly', () => {
    let calls = 0
    const array = ['a', 'b', 'c']
    const state = stateify({foo: array})
    state.foo.addEventListener('propertychange', event => {
        const {property, unknown} = event.detail
        calls++
        if(calls == 1) assert(property == '0')
        if(calls == 2) assert(unknown == true)
    })
    state.foo = [1, 2, 3]
    assert(calls == 0)
    state.foo[0] = 4
    assert(calls == 1)
    state.foo.reverse()
    assert(calls == 2)
    array[0] = 'A'
    assert(calls == 2)
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
