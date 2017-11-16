import { InputObservable } from '../InputObservable'

describe('InputObservable class', () => {
  const inputElements = [document.createElement('input')]

  it('should set config properties', () => {
    const obs$ = new InputObservable({
      checkboxEvent: 'blur',
      inputElements,
      radioEvent: 'click',
      selectEvent: 'click',
      textEvent: 'focus',
    })

    expect(obs$.checkboxEvent).toBe('blur')
    expect(obs$.radioEvent).toBe('click')
    expect(obs$.selectEvent).toBe('click')
    expect(obs$.textEvent).toBe('focus')
  })

  it('should set the initial value', () => {
    const obs$ = new InputObservable({
      initialValue: { test: { value: 'test' } },
      inputElements,
    })

    expect(obs$.getValue()).toEqual({ test: { value: 'test' } })
  })

  describe('data formatter', () => {
    let reduceFieldSpy: any
    beforeEach(() => {
      reduceFieldSpy = jest.spyOn(InputObservable.prototype, 'reduceField')
    })

    it('should call reduceField when format standard input', () => {
      const obs$ = new InputObservable({ inputElements })
      obs$.standardInputFormatter({ target: { name: 'test', value: 'test', type: 'text' } })
      expect(reduceFieldSpy).toHaveBeenCalledWith('test', 'test', 'text')
    })

    it('should call reduceField when format checkbox input', () => {
      const obs$ = new InputObservable({ inputElements })
      obs$.checkboxInputFormatter({ target: { name: 'test', value: 'test', checked: true, type: 'checkbox' } })
      expect(reduceFieldSpy).toHaveBeenCalledWith('test', true, 'checkbox')
    })
  })

  describe('field reducer', () => {
    it('should properly format data', () => {
      expect(InputObservable.prototype.reduceField('test', 'test', 'test')).toEqual({
        test: {
          dirty: true,
          touched: true,
          value: 'test',
        },
      })
    })
  })
})