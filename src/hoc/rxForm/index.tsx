import * as React from 'react'
import { findDOMNode } from 'react-dom'
import { Subscription, Subject, Observable } from 'rxjs'
import autobind from 'autobind-decorator'

import { FieldValue, FormValues, FormSubmitValues, RequiredProps, RxFormState, RxFormProps, RxFormParams } from 'types'
import { validateFiledsWithInputName } from './utils/validation'

/**
 * Decorate a react componnent with a form tag as root
 * @param param configuration object of the hoc
 * @param param.fields Object representing the input of the form (value, validation ...), each key must correspond with the
 * name attribute of an input element
 * @param [param.debounce = 300] debounce in ms
 * @param [param.throttle] throttle in ms
 * @returns a function wich take a react component as arg and return a react component
 */
export const rxForm = function<Props extends RequiredProps>({
  fields,
  valueChangeObs,
  debounce = 300,
  throttle = 0,
}: RxFormParams<Props>) {
  return (Comp: React.ComponentClass<Props & RxFormProps> | React.StatelessComponent<Props & RxFormProps>) => {
    /**
     * RxForm Higher order component
     */
    class RxForm extends React.Component<Props, RxFormState> {
      static displayName = `RxForm(${Comp.displayName || Comp.name})`

      static defaultProps = {
        onError: () => {},
      }

      state: RxFormState = this.initState()
      /**
       * An rxjs Observable, tick each time the form state change
       */
      valueChange$ = new Subject<FormValues>()
      /**
       * An rxjs Observable, tick when the form is submitted, call the onSubmit props
       */
      formSubmit$: Observable<FormSubmitValues>
      /**
       * the subscription of the valueChange$ Observable
       */
      inputSubscription: Subscription
      /**
       * the subscription of the formSubmit$ Observable
       */
      formSubmitSubscription: Subscription

      /**
       * The Root element of the decorated component (for now must be a form tag)
       */
      formElement: Element
      /**
       * An array of the inputs tag with a name attribute
       */
      inputElements: HTMLInputElement[]

      /**
       * transform the data from the inputs observable
       * @param fieldName the name of the input
       * @param value the value of the input
       * @param dirty indicate if the field has a value
       * @param touched indicate if the user already fill something
       */
      reduceFieldData(fieldName: string, value: FieldValue, dirty = true, touched = true): FormValues {
        return {
          [fieldName]: {
            dirty,
            touched,
            value,
          },
        }
      }

      /**
       * Determine if a field has an error and return it
       * @param value the value of the input
       * @param key the name of the input
       */
      getFieldError(value: FieldValue, key: string): string | undefined {
        /**
         * if the state is not defined yet, we build a fake one for the validation functions
         */
        const initEmptyFormValue = () => {
          return Object.keys(fields).reduce(
            (acc, fieldName) => ({
              ...acc,
              [fieldName]: {},
            }),
            {},
          )
        }

        const field = fields[key]

        if (field.validation) {
          return field.validation(value, this.state ? this.state.formValue : initEmptyFormValue(), this.props)
        }
      }

      /**
       * initialize the state of the component
       */
      initState(): RxFormState {
        const fieldKeys = Object.keys(fields)

        const initialFormState = {
          dirty: false,
          formValue: {},
          submitted: false,
        }

        return fieldKeys.reduce((state, fieldName) => {
          const fieldMeta = fields[fieldName]
          const fieldValue = typeof fieldMeta.value === 'function' ? fieldMeta.value(this.props) : fieldMeta.value || ''
          const fieldError = this.getFieldError(fieldValue, fieldName)
          const dirty = !!fieldValue

          return {
            ...state,
            dirty,
            formValue: {
              ...state.formValue,
              [fieldName]: {
                dirty,
                error: fieldError,
                value: fieldValue,
              },
            },
          }
        }, initialFormState)
      }

      /**
       * return an Observable of the given event of the inputs elements of the given types 
       * @param types  the types of input element to include
       * @param eventType the event to subscribe
       */
      createInputObservable(eventType: string, types = ['text', 'email', 'password', 'search']): Observable<any> {
        return new Subject().merge(
          ...this.inputElements
            .filter(element => types.includes(element.type))
            .map(element => Observable.fromEvent(element, eventType)),
        )
      }

      /**
       * Check if the form has error
       */
      hasError(): boolean {
        let hasError = false
        Object.keys(fields).some(fieldName => {
          if (this.state.formValue[fieldName].error) {
            hasError = true
            return true
          }
          return false
        })
        return hasError
      }

      /**
       * Usefull to update the form state without trigering dom event, (custom component)
       * @param {state} - the data to add to the state { [fieldName]: fieldValue }
       * @returns {void}
       */
      @autobind
      setValue(state: any) {
        this.setState({
          formValue: {
            ...this.state.formValue,
            ...state,
          },
        })
      }

      /**
       * bind the root element of the decorated component to the class (must be a form tag)
       * handler for the ref attribute of the decorated component
       * @param form 
       */
      @autobind
      attachFormElement(form: Element) {
        this.formElement = findDOMNode(form)
      }

      /**
       * set the initial value of input tag if specified in the config
       */
      setInitialInputValues() {
        Object.keys(fields).forEach(inputName => {
          const inputElement = this.inputElements.find(element => element.getAttribute('name') === inputName)
          if (inputElement) {
            inputElement.value = this.state.formValue[inputName].value.toString()
          }
        })
      }

      /**
       * return the formatted input data
       * @param event an input event object
       */
      @autobind
      handleCheckboxChange(event: any) {
        return this.reduceFieldData(event.target.name, !this.state.formValue[event.target.name].value)
      }

      /**
       * return the formatted input data
       * @param event an input event object
       */
      @autobind
      handleTextInputChange(event: any) {
        return this.reduceFieldData(event.target.name, event.target.value)
      }

      /**
       * return the formatted input data
       * @param event an input event object
       */
      @autobind
      handleRadioButtonChange(event: any) {
        return this.reduceFieldData(event.target.name, event.target.value)
      }

      /**
       * update the state of the form each time an input change and tick the valueChange$ Observable
       * @param formValue the state of the form 
       */
      @autobind
      handleInputSubscribeSuccess(formValue: FormValues) {
        const inputName = Object.keys(formValue)[0]

        formValue[inputName].error = this.getFieldError(formValue[inputName].value, inputName)

        this.setState({
          dirty: true,
          formValue: {
            ...this.state.formValue,
            ...formValue,
          },
        })
      }

      @autobind
      handleFormSubmit(event: any) {
        event.preventDefault()
        let errorObject = {}
        let hasError = false

        const formValue = Object.keys(fields).reduce((obj, fieldName) => {
          if (this.state.formValue[fieldName].error) {
            hasError = true
            errorObject = {
              ...errorObject,
              [fieldName]: this.state.formValue[fieldName].error,
            }
          }

          return {
            ...obj,
            [fieldName]: this.state.formValue[fieldName].value,
          }
        }, {})

        if (hasError) {
          throw errorObject
        }

        this.setState({ submitted: true })

        return formValue
      }

      componentDidMount() {
        this.inputElements = Array.from(this.formElement.querySelectorAll('input')).filter(element =>
          element.hasAttribute('name'),
        )

        validateFiledsWithInputName(fields, this.inputElements)

        this.setInitialInputValues()

        this.formSubmit$ = Observable.fromEvent(this.formElement, 'submit').map(this.handleFormSubmit)

        this.inputSubscription = this.valueChange$
          .merge(this.createInputObservable('input').map(this.handleTextInputChange))
          .merge(this.createInputObservable('change', ['checkbox']).map(this.handleCheckboxChange))
          .merge(this.createInputObservable('change', ['radio']).map(this.handleRadioButtonChange))
          .debounceTime(debounce)
          .throttleTime(throttle)
          .subscribe(this.handleInputSubscribeSuccess)

        this.formSubmitSubscription = this.formSubmit$.subscribe(this.props.onSubmit, this.props.onError)
      }

      componentWillUnmount() {
        this.formSubmitSubscription.unsubscribe()
        this.inputSubscription.unsubscribe()
      }

      render() {
        return (
          <Comp
            ref={this.attachFormElement}
            valueChange$={valueChangeObs ? this.valueChange$ : null}
            formSubmit$={this.formSubmit$}
            setValue={this.setValue}
            valid={!this.hasError()}
            submitted={this.state.submitted}
            {...this.state.formValue}
            {...this.props}
          />
        )
      }
    }

    return RxForm
  }
}
