import React from "react";
import { ContextSelectorHook } from "react-context-subscribers/lib/interfaces";
export declare type AnyStafly = SingleStafly<any, any, any> | MultiStafly<any, any, any, any>;
declare function staflySkyRaw(...staflys: AnyStafly[]): <T extends React.ComponentType>(component: T) => T;
export declare const staflySky: typeof staflySkyRaw & {
    memo: typeof staflySkyRaw;
};
interface EmptyObject {
}
declare type AnyObject = Record<string, unknown> | readonly any[];
declare type AnyReducerObject<Value> = {
    [key in string]?: (state: Value, ...params: any[]) => Value;
};
declare type AnyKeyReducerObject<Key, Value> = {
    [reducer in string]?: (key: Key, state: Value, ...params: any[]) => Value;
};
declare type AnyElementReducerObject<Value> = AnyKeyReducerObject<KeyOf<Value>, ValueOnKey<Value, KeyOf<Value>>>;
interface CreateSingleStafly<AdditionalSettings extends AnyObject = {}> {
    <Value, SetterParams extends any[] = []>(): EmptyObject extends AdditionalSettings ? SingleStafly<Value | DefaultValue, EmptyObject, SetterParams> : "Warning: creating `Stafly` without arguments is isDisabled. Please, pass an object as an argument";
    <Value, SetterParams extends any[] = []>(args: {
        defaultValue: Value | (() => Value);
    } & StaflyCommonOptions<Value> & AdditionalSettings): SingleStafly<Value, EmptyObject, SetterParams>;
    <Value, SetterParams extends any[] = []>(args: {
        defaultValue?: Value | (() => Value);
    } & StaflyCommonOptions<Value> & AdditionalSettings): SingleStafly<Value | DefaultValue, EmptyObject, SetterParams>;
}
export interface StaflyCommonOptions<Value = any> {
    equalityFn?: (value1: Value, value2: Value) => boolean;
    ignoreMultipleSettersError?: boolean;
}
export declare const createStafly: CreateSingleStafly;
export declare const staflyFactory: <AdditionalSettings extends AnyObject = {}>(settings: {
    setterModifier?: ((fn: (state: any) => any, additionalOptions: AdditionalSettings) => (state: any) => any) | undefined;
    options?: StaflyCommonOptions<any> | undefined;
    onAfterCreation?: ((stafly: AnyStafly, additionalOptions: AdditionalSettings) => void) | undefined;
    modifyOptions?: ((combinedOptions: AdditionalSettings & StaflyCommonOptions<any>) => AdditionalSettings & StaflyCommonOptions<any>) | undefined;
}) => CreateSingleStafly<AdditionalSettings>;
declare type ElementEqualityFn<Value> = ElementEqualityFnHelper<ValueOnKey<Value, KeyOf<Value>>, KeyOf<Value>>;
declare type ElementEqualityFnHelper<Value, Key> = (value1: Value, value2: Value, key: Key) => boolean;
declare type DefaultValue = undefined;
export interface StaflyCommonHooks<Value, Reducers extends AnyReducerObject<Value> | AnyKeyReducerObject<any, any> = EmptyObject, AreReducersTopLevel extends boolean = true, SetterParams extends any[] = []> {
    useValue: () => Value;
    useValueGetterFn: () => (...params: SetterParams) => Value;
    useSetValue: SingleSetValue<Value>;
    useValueSetterFn: () => SetterFn<Value>;
    useRegisterValueSetter: (fn: (currentValue: Value, ...args: SetterParams) => Value) => void;
    useSelector: ContextSelectorHook<[Value]>;
    useDispatcher: UseDispatcher<Value, Reducers, AreReducersTopLevel>;
    useSubscriber: ChangeSubscriber<Value, void>;
    useSubscriberFn: () => ChangeSubscriber<Value>;
}
export interface StaflyCommonFunctions<Value, Reducers extends AnyReducerObject<Value> | AnyKeyReducerObject<any, any> = EmptyObject, AreReducersTopLevel extends boolean = true, SetterParams extends any[] = []> {
    getValue: (...params: SetterParams) => Value;
    setValue: SetterFn<Value>;
    registerValueSetter: (fn: (currentValue: Value, ...args: SetterParams) => Value) => () => void;
    subscribeToValueChange: ChangeSubscriber<Value>;
    dispatch: UseDispatcher<Value, Reducers, AreReducersTopLevel>;
}
interface SingleStafly<Value, Reducers extends AnyReducerObject<Value> = EmptyObject, SetterParams extends any[] = []> extends StaflyCommonHooks<Value, Reducers, true, SetterParams> {
    Provider: React.ComponentType;
    globally: StaflyCommonFunctions<Value, Reducers, true, SetterParams>;
    addReducers: <AdditionalReducers extends AnyReducerObject<Value>>(reducers: AdditionalReducers) => SingleStafly<Value, Reducers & AdditionalReducers, SetterParams>;
    asArray: (options?: {
        elementEqualityFn?: ElementEqualityFn<Value>;
    }) => MultiStafly<Value, Reducers, EmptyObject, SetterParams>;
    asMultiKey: (options?: {
        elementEqualityFn?: ElementEqualityFn<Value>;
    }) => MultiStafly<Value, Reducers, EmptyObject, SetterParams>;
}
declare type UseDispatcher<Value, Reducers extends AnyReducerObject<Value> | AnyKeyReducerObject<any, Value>, AreReducersTopLevel extends boolean = true> = <ReducerName extends keyof Reducers>(reducerName: ReducerName) => (...args: AreReducersTopLevel extends true ? ParametersExceptFirst<Reducers[ReducerName]> : ParametersExceptFirstTwo<Reducers[ReducerName]>) => void;
declare type ParametersExceptFirst<Fn> = Fn extends (value: any, ...args: infer R) => void ? R : never;
declare type ParametersExceptFirstTwo<Fn> = Fn extends (key: any, value: any, ...args: infer R) => void ? R : never;
interface ChangeSubscriber<Value, ReturnType = () => void> {
    (fn: (changedValue: Value) => void): ReturnType;
}
interface SingleSetValue<Value> {
    (value: Value, deps?: readonly any[]): Value;
    (fn: (currentValue: Value) => Value, deps?: readonly any[]): Value;
}
interface SetterFn<Value> {
    (newValue: Value | ((currentValue: Value) => Value)): void;
}
interface MultiStafly<Value, Reducers extends AnyReducerObject<Value> = EmptyObject, ElementReducers extends AnyElementReducerObject<Value> = EmptyObject, SetterParams extends any[] = []> extends StaflyCommonHooks<Value, Reducers, true, SetterParams> {
    globally: StaflyCommonFunctions<Value, Reducers, true, SetterParams>;
    useKey: <Key extends KeyOf<Value>>(key: Key) => StaflyCommonHooks<ValueOnKey<Value, Key>, ElementReducers, false, SetterParams>;
    useKeyFunctionsGetter: () => <Key extends KeyOf<Value>>(key: Key) => StaflyCommonFunctions<ValueOnKey<Value, Key>, ElementReducers, false, SetterParams>;
    useKeyHooksGetter: () => <Key extends KeyOf<Value>>(key: Key) => StaflyCommonHooks<ValueOnKey<Value, Key>, ElementReducers, false, SetterParams>;
    onGlobalKey: <Key extends KeyOf<Value>>(key: Key) => StaflyCommonFunctions<ValueOnKey<Value, Key>, ElementReducers, false, SetterParams>;
    Provider: React.ComponentType;
    addReducers: <AdditionalReducers extends AnyReducerObject<Value>>(reducers: AdditionalReducers) => MultiStafly<Value, Reducers & AdditionalReducers, ElementReducers, SetterParams>;
    addKeyReducers: <AdditionalReducers extends AnyElementReducerObject<Value>>(reducers: AdditionalReducers) => MultiStafly<Value, Reducers, ElementReducers & AdditionalReducers, SetterParams>;
}
export declare type KeyOf<Obj> = Obj extends readonly any[] ? number : keyof Obj;
export declare type ValueOnKey<Value, Key> = Value extends undefined | null ? Value : Value extends readonly any[] ? Key extends keyof Value ? Value[Key] | undefined : never : Value[Key & keyof Value];
export {};
