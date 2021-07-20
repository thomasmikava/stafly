/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable max-lines-per-function */
/* eslint-disable max-lines */
/* eslint-disable react-hooks/rules-of-hooks */
import React, {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ContextSubscriber } from "react-context-subscribers";
import {
  ContextSelectorHook,
  SubscribeFn,
} from "react-context-subscribers/lib/interfaces";
import Subscription from "simple-subscriptions";

export type AnyStafly =
  | SingleStafly<any, any, any>
  | MultiStafly<any, any, any, any>;

function staflySkyRaw(
  ...staflys: AnyStafly[]
): <T extends React.ComponentType>(component: T) => T;
function staflySkyRaw(...staflys: AnyStafly[]) {
  let memoized = false;
  if (staflys[0] === ("memo" as any)) {
    memoized = true;
    staflys = staflys.slice(1);
  }
  return function StaflyedComponent<T extends React.ComponentType>(
    component: T
  ): T {
    const forwardedComp = React.forwardRef((props, ref) => {
      let children = React.createElement(component as any, {
        ...props,
        ref,
      });

      for (const stafly of staflys) {
        children = React.createElement(stafly.Provider, {}, children) as any;
      }

      return children as any;
    }) as any;
    if (memoized) return React.memo(forwardedComp) as any;
    return forwardedComp;
  };
}

const memoized = {
  memo: ((...args: any) =>
    staflySkyRaw("memo" as any, ...args)) as typeof staflySkyRaw,
};

export const staflySky = Object.assign(staflySkyRaw, memoized);

interface EmptyObject {}
type AnyObject = Record<string, unknown> | readonly any[];
type AnyReducerObject<Value> = {
  [key in string]?: (state: Value, ...params: any[]) => Value;
};
type AnyKeyReducerObject<Key, Value> = {
  [reducer in string]?: (key: Key, state: Value, ...params: any[]) => Value;
};
type AnyElementReducerObject<Value> = AnyKeyReducerObject<
  KeyOf<Value>,
  ValueOnKey<Value, KeyOf<Value>>
>;
///
interface CreateStaflyStore<AdditionalSettings extends AnyObject = {}> {
  <
    Value,
    SetterParams extends any[] = []
  >(): EmptyObject extends AdditionalSettings
    ? SingleStafly<Value | DefaultValue, EmptyObject, SetterParams>
    : "Warning: creating `Stafly` without arguments is isDisabled. Please, pass an object as an argument";
  <Value, SetterParams extends any[] = []>(
    args: {
      defaultValue: Value | (() => Value);
    } & StaflyCommonOptions<Value> &
      AdditionalSettings
  ): SingleStafly<Value, EmptyObject, SetterParams>;
  <Value, SetterParams extends any[] = []>(
    args: {
      defaultValue?: Value | (() => Value);
    } & StaflyCommonOptions<Value> &
      AdditionalSettings
  ): SingleStafly<Value | DefaultValue, EmptyObject, SetterParams>;
}

export interface StaflyCommonOptions<Value = any> {
  equalityFn?: (value1: Value, value2: Value) => boolean;
  ignoreMultipleSettersError?: boolean;
}

//

export const createStore: CreateStaflyStore = (options?: any): any => {
  if (!options) options = {};
  return createSingleStafly({ ...options });
};

export const staflyFactory = <
  AdditionalSettings extends AnyObject = {}
>(settings: {
  setterModifier?: (
    fn: (state: any) => any,
    additionalOptions: AdditionalSettings & StaflyCommonOptions
  ) => (state: any) => any;
  options?: StaflyCommonOptions;
  onAfterCreation?: (
    stafly: AnyStafly,
    additionalOptions: AdditionalSettings & StaflyCommonOptions
  ) => void;
  modifyOptions?: (
    combinedOptions: AdditionalSettings & StaflyCommonOptions
  ) => AdditionalSettings & StaflyCommonOptions;
}): CreateStaflyStore<AdditionalSettings> => {
  return ((options) => {
    let combinedOptions = { ...(settings.options || {}), ...options };
    if (settings.modifyOptions) {
      combinedOptions = settings.modifyOptions(combinedOptions);
    }
    const stafly = createStore(combinedOptions);
    if (settings.onAfterCreation) {
      settings.onAfterCreation(stafly, { ...combinedOptions });
    }
    return stafly;
  }) as any;
};

const throwMultipleSettersError = () => {
  throw new Error("StaflyMultipleSettersError: more than 1 value setter is attached to stafly store. If you're absolutely sure to ignore this error, pass `{ ignoreMultipleSettersError: true }` to `createStore`");
};

interface MiniContextSubscraberValue<Data extends readonly any[]> {
  getLatestValue: () => Data;
  updateValue: (...value: Data) => void;
  subscribe: SubscribeFn<Data>;
}

interface ContextValue<Value, SetterParams extends any[]> {
  internal: MiniContextSubscraberValue<[Value]>;
  getSubscriber: () => Subscription<
    (currentValue: Value, ...params: SetterParams) => Value
  >;
}

const getHelperHooks = <
  Value,
  Reducers extends AnyReducerObject<Value> | AnyKeyReducerObject<any, Value>,
  AreReducersTopLevel extends boolean,
  SetterParams extends any[]
>({
  useSelector,
  options,
  useContextValue,
  useOnUnmount,
  subReducerInfo,
}: {
  useSelector: ContextSelectorHook<[Value]>;
  options: any;
  useContextValue: () => ContextValue<Value, SetterParams>;
  useOnUnmount?: () => (helpers: {
    internal: MiniContextSubscraberValue<[Value]>;
    subscriber: Subscription<
      (currentValue: Value, ...params: SetterParams) => Value
    >;
  }) => void;
  subReducerInfo?: SubReducerInfo;
}): StaflyCommonHooks<Value, Reducers, AreReducersTopLevel, SetterParams> => {
  const useValue = (): Value => {
    return useSelector()[0];
  };

  const useValueGetterFn = (): (() => Value) => {
    const { internal, getSubscriber } = useContextValue();
    return useCallback(
      (...params: SetterParams) => {
        return getValueHelper(internal, getSubscriber, options, params);
      },
      [internal, getSubscriber]
    );
  };

  const useRegisterOn = (
    internal: MiniContextSubscraberValue<[Value]>,
    getSubscriber: () => Subscription<
      (currentValue: Value, ...params: SetterParams) => Value
    >,
    fnRef: React.MutableRefObject<
      (currentValue: Value, ...args: SetterParams) => Value
    >
  ) => {
    const onUnmount = useOnUnmount?.();
    useLayoutEffect(() => {
      const subscriber = getSubscriber();
      if (
        subscriber.getSubscribersCount() > 0 &&
        !options.ignoreMultipleSettersError
      ) {
        throwMultipleSettersError();
      }
      const unsubscribe = subscriber.subscribe((...args) => {
        return fnRef.current(...args);
      });
      return () => {
        unsubscribe();
        onUnmount?.({ internal, subscriber });
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getSubscriber, internal, onUnmount]);
  };

  const useSetValue: SingleSetValue<Value> = (vl, deps?: readonly any[]) => {
    const { internal, getSubscriber } = useContextValue();
    let newValue = vl;
    const newValueRef = useRef(newValue);
    if (typeof vl !== "function") {
      newValue = useMemo(() => vl, deps || [vl]);
    } else {
      newValue = useMemo(() => {
        const modifiedReducer = getModifiedReducer<Value>(vl, [], options);
        return modifiedReducer(internal.getLatestValue()[0]);
      }, deps || [{}]);
    }
    const newValueFnRef = useRef(() => newValueRef.current);
    useLayoutEffect(() => {
      internal.updateValue(newValue);
      newValueRef.current = newValue;
    });
    useRegisterOn(internal, getSubscriber, newValueFnRef);
    return newValue;
  };

  const useRegisterValueSetter = (
    fn: (currentValue: Value, ...args: SetterParams) => Value
  ) => {
    const { internal, getSubscriber } = useContextValue();
    const fnRef = useRef(fn);
    useLayoutEffect(() => {
      fnRef.current = (value: Value, ...args) => {
        const finalFn = getModifiedReducer<Value>(fn as any, args, options);
        return finalFn(value);
      };
    }, [fn]);
    useRegisterOn(internal, getSubscriber, fnRef);
  };

  const useValueSetterFn = (): SetterFn<Value> => {
    const { internal } = useContextValue();
    return useCallback<SetterFn<Value>>(
      (vl) => {
        if (typeof vl === "function") {
          const modifiedReducer = getModifiedReducer(vl as any, [], options);
          vl = modifiedReducer(internal.getLatestValue()[0]);
        }
        internal.updateValue(vl as Value);
      },
      [internal]
    );
  };

  const useSubscriber: ChangeSubscriber<Value, void> = (fn) => {
    const { internal } = useContextValue();
    const fnRef = useRef(fn);
    useLayoutEffect(() => {
      fnRef.current = fn;
    });
    useLayoutEffect(() => {
      return internal.subscribe((...params) => {
        return fnRef.current(...params);
      });
    }, [internal]);
  };

  const useSubscriberFn = (): ChangeSubscriber<Value> => {
    const { internal } = useContextValue();
    return useCallback(
      (fn) => {
        return internal.subscribe(fn);
      },
      [internal]
    );
  };

  const useDispatcher: UseDispatcher<Value, Reducers, AreReducersTopLevel> = (
    key: any
  ) => {
    const { internal } = useContextValue();
    return useCallback(
      createReducer(internal, key, options as any, subReducerInfo),
      [internal, key]
    );
  };

  return {
    useSelector,
    useValue,
    useValueGetterFn,
    useSetValue,
    useRegisterValueSetter,
    useValueSetterFn,
    useDispatcher,
    useSubscriber,
    useSubscriberFn,
  };
};

const getValueHelper = <Value, SetterParams extends any[]>(
  internal: MiniContextSubscraberValue<[Value]>,
  getSubscriber: () => Subscription<
    (currentValue: Value, ...params: SetterParams) => Value
  >,
  options: any,
  params: SetterParams
) => {
  const currentValue = internal.getLatestValue()[0];
  const subscriber = getSubscriber();
  const values = subscriber.broadcast(currentValue, ...params);
  if (values.length > 1 && !options.ignoreMultipleSettersError) {
    throwMultipleSettersError();
  }
  if (values.length > 0) {
    const value = values[0];
    internal.updateValue(value);
    return value;
  }
  return currentValue;
};

const getHelperGlobals = <
  Value,
  Reducers extends AnyReducerObject<Value>,
  AreReducersTopLevel extends boolean,
  SetterParams extends any[]
>({
  options,
  getGlobalContextValue,
  subReducerInfo,
}: {
  options: any;
  getGlobalContextValue: () => ContextValue<Value, SetterParams>;
  subReducerInfo?: SubReducerInfo;
}): StaflyCommonFunctions<
  Value,
  Reducers,
  AreReducersTopLevel,
  SetterParams
> => {
  const getValue = (...params: SetterParams): Value => {
    const globalContextValue = getGlobalContextValue();
    return getValueHelper(
      globalContextValue.internal,
      globalContextValue.getSubscriber,
      options,
      params
    );
  };

  const registerValueSetter: StaflyCommonFunctions<
    Value,
    Reducers,
    AreReducersTopLevel,
    SetterParams
  >["registerValueSetter"] = (fn) => {
    const globalContextValue = getGlobalContextValue();
    const subscriber = globalContextValue.getSubscriber();
    if (
      subscriber.getSubscribersCount() > 0 &&
      !options.ignoreMultipleSettersError
    ) {
      throwMultipleSettersError();
    }
    return subscriber.subscribe(fn);
  };

  /* const getCurrenetGlobalValue = (): Value => {
    return getGlobalContextValue().internal.getLatestValue()[0];
  }; */

  const setValue: SetterFn<Value> = (newValue) => {
    let val = newValue as Value;
    if (typeof newValue === "function") {
      val = getModifiedReducer(val as any, [], options)(newValue as Value);
    }
    getGlobalContextValue().internal.updateValue(val);
  };

  const subscribeToValueChange: ChangeSubscriber<Value> = (fn) => {
    return getGlobalContextValue().internal.subscribe(fn);
  };

  const dispatch: UseDispatcher<Value, Reducers, AreReducersTopLevel> = (
    key: any
  ) => {
    const internal = getGlobalContextValue().internal;
    return createReducer(internal, key, options as any, subReducerInfo);
  };

  return {
    getValue,
    setValue,
    subscribeToValueChange,
    dispatch,
    registerValueSetter,
  };
};

interface Internalss<Value, SetterParams extends any[]> {
  useContextValue: () => {
    internal: MiniContextSubscraberValue<[Value]>;
    getSubscriber: () => Subscription<
      (currentValue: Value, ...params: SetterParams) => Value
    >;
  };
  getGlobalInternal: () => MiniContextSubscraberValue<[Value]>;
  mainContextValue: ContextValue<Value, SetterParams>;
}

// eslint-disable-next-line max-lines-per-function
function createSingleStafly<
  Value,
  Reducers extends AnyReducerObject<Value> = EmptyObject,
  SetterParams extends any[] = []
>(options: {
  defaultValue?: Value | (() => Value);
  equalityFn?: (value1: Value, value2: Value) => boolean;
  ignoreMultipleSettersError?: boolean;
  reducers?: Reducers;
  setterModifier?: (
    fn: (state: any) => any,
    additionalOptions: any
  ) => (state: any) => any;
}): SingleStafly<Value, Reducers, SetterParams> {
  type ContextVal = [Value];
  const defaultValue = options.hasOwnProperty("defaultValue")
    ? (options.defaultValue as Value)
    : stuffDefaultValue;
  const defaultValueGetter = (typeof defaultValue === "function"
    ? () => [defaultValue()]
    : () => [defaultValue]) as () => ContextVal;

  const contextSubscriber = new ContextSubscriber<ContextVal>(
    defaultValueGetter,
    "function",
    options.equalityFn
      ? createEqualityFnForContext(options.equalityFn)
      : undefined
  );

  const createContextValue = (isDefaultCall?: boolean) => {
    const registered = isDefaultCall
      ? contextSubscriber.defaultProvider
      : contextSubscriber.registerNewProvider();
    const subscriber = new Subscription<
      (currentValue: Value, ...params: SetterParams) => Value
    >({});

    if (!isDefaultCall) {
      registered.updateValue(...defaultValueGetter());
    }

    return {
      internal: registered,
      getSubscriber: () => subscriber,
    };
  };

  const mainContextValue = createContextValue(true);
  const MainContext = React.createContext(mainContextValue);

  const useContextValue = () => useContext(MainContext);
  const getGlobalInternal = () => mainContextValue.internal;

  const helperHooks = getHelperHooks<Value, Reducers, true, SetterParams>({
    useSelector: contextSubscriber.useSelector,
    options,
    useContextValue,
  });
  const globalFns = getHelperGlobals<Value, Reducers, true, SetterParams>({
    options,
    getGlobalContextValue: () => mainContextValue,
  });

  const Provider: React.FC = ({ children }) => {
    const [contextValue] = useState(createContextValue);
    const internal = contextValue.internal;

    useLayoutEffect(() => {
      if ((options as any).__afterEffect) {
        (options as any).__afterEffect(contextValue);
      }
      return () => internal.destroy();
    }, []);

    return React.createElement(
      MainContext.Provider,
      {
        value: contextValue,
      },
      React.createElement(contextSubscriber.context.Provider, {
        value: internal,
        children,
      })
    );
  };

  const internals: Internalss<Value, SetterParams> = {
    useContextValue,
    getGlobalInternal,
    mainContextValue,
  };

  const additionalSettings = {
    __internal: internals,
  };

  const addReducers = (reducers): any => {
    options.reducers = { ...options.reducers, ...reducers };
    return stafly;
  };

  const asArray = (additionalOptions = {}): any => {
    Object.assign(options, additionalOptions);
    (options as any).__isArray = true;
    return createMultiStaflyHelper<Value, Reducers, EmptyObject, SetterParams>(
      options as any,
      stafly
    );
  };

  const asMultiKey = (additionalOptions = {}): any => {
    Object.assign(options, additionalOptions);
    return createMultiStaflyHelper<Value, Reducers, EmptyObject, SetterParams>(
      options as any,
      stafly
    );
  };

  const stafly: SingleStafly<Value, Reducers, SetterParams> = {
    ...helperHooks,
    globally: globalFns,
    useSelector: contextSubscriber.useSelector,
    Provider,
    addReducers,
    asArray,
    asMultiKey,
    ...additionalSettings,
  };
  return stafly;
}

type EqualityFn<Value> = (value1: Value, value2: Value) => boolean;
type ElementEqualityFn<Value> = ElementEqualityFnHelper<
  ValueOnKey<Value, KeyOf<Value>>,
  KeyOf<Value>
>;
type ElementEqualityFnHelper<Value, Key> = (
  value1: Value,
  value2: Value,
  key: Key
) => boolean;

function createMultiStaflyHelper<
  Value,
  Reducers extends AnyReducerObject<Value> = EmptyObject,
  ElementReducers extends AnyElementReducerObject<Value> = EmptyObject,
  SetterParams extends any[] = []
>(
  options: {
    defaultValue: Value | (() => Value);
    __isArray?: boolean;
    equalityFn?: EqualityFn<Value>;
    elementEqualityFn?: ElementEqualityFn<Value>;
  },
  parent: SingleStafly<Value, Reducers, SetterParams>
): MultiStafly<Value, Reducers, ElementReducers, SetterParams> {
  const areElementsEqual = (value1: any, value2: any, key: any) => {
    if (!options.elementEqualityFn) {
      return value1 === value2;
    }
    return options.elementEqualityFn(value1, value2, key);
  };
  const getParentNewValue = (
    value: Value,
    parnetSubscriber: Subscription<
      (currentValue: Value, ...params: SetterParams) => Value
    >,
    getKeyValue: <Key extends KeyOf<Value>>(
      value: Value,
      key: Key,
      settings: {
        subscriber: Subscription<
          (
            currentValue: ValueOnKey<Value, Key>,
            ...params: ElementSetterParams
          ) => ValueOnKey<Value, Key>
        >;
        internal: MiniContextSubscraberValue<[ValueOnKey<Value, Key>]>;
      }
    ) => ValueOnKey<Value, Key>
  ) => {
    const meta = parnetSubscriber.getMetaData() as any;
    const keySubscribers = meta.keySubscribers;
    if (!keySubscribers) return value;
    const dublicated = dublicateValue(
      (undefined as any) as Value,
      options.__isArray || Array.isArray(value)
    );
    let isChanged = false;
    for (const key in keySubscribers) {
      const k = key as KeyOf<Value>;
      const child = keySubscribers[key] as {
        subscriber: Subscription<
          (
            currentValue: ValueOnKey<Value, KeyOf<Value>>,
            ...params: ElementSetterParams
          ) => ValueOnKey<Value, KeyOf<Value>>
        >;
        internal: MiniContextSubscraberValue<[ValueOnKey<Value, KeyOf<Value>>]>;
      };
      const subscriber = child.subscriber;
      let keyValue: ValueOnKey<Value, KeyOf<Value>>;
      if (subscriber.getSubscribersCount() === 0) {
        delete keySubscribers[key];
        delete dublicated[key];
        if (key in (value || {})) isChanged = true;
      } else {
        keyValue = getKeyValue(value, k, child) as any;
        if (!value || !areElementsEqual(value[key], keyValue, k)) {
          isChanged = true;
        }
        dublicated[key] = keyValue;
      }
    }
    if (!isChanged) return value;
    return dublicated;
  };

  type ElementSetterParams = SetterParams;
  const __afterEffect = (contextValue: ContextValue<Value, SetterParams>) => {
    const subscriber = contextValue.getSubscriber();
    if (
      subscriber.getSubscribersCount() > 0 &&
      !(options as any).ignoreMultipleSettersError
    ) {
      throwMultipleSettersError();
    }

    let lastFn;
    let lastTimeout;
    (contextValue.internal as any).debouncedUpdateValue = (fn: () => Value) => {
      if (lastTimeout === undefined) {
        lastTimeout = setTimeout(() => {
          lastTimeout = undefined;
          const value = lastFn();
          contextValue.internal.updateValue(value);
        }, 0);
      }
      lastFn = fn;
    };

    subscriber.subscribe((value, ...params) => {
      return getParentNewValue(
        value,
        subscriber,
        (value, key, { subscriber }) =>
          subscriber.broadcast(value?.[key as any], ...params)[0]
      );
    });
  };

  (options as any).__afterEffect = __afterEffect;
  __afterEffect(
    ((parent as any).__internal as Internalss<Value, SetterParams>)
      .mainContextValue
  );

  const createChildInternal = <Key extends KeyOf<Value>>(
    key: Key,
    parentInternal: MiniContextSubscraberValue<[Value]>
  ): MiniContextSubscraberValue<[ValueOnKey<Value, Key>]> => ({
    getLatestValue: () => [parentInternal.getLatestValue()[0]?.[key as any]!],
    subscribe: (fn) => {
      let currentValue = parentInternal.getLatestValue()[0]?.[key as any]!;
      return parentInternal.subscribe((newParentValue) => {
        const newValue = newParentValue?.[key as any]!;
        if (!areElementsEqual(currentValue, newValue, key)) {
          currentValue = newValue;
          fn(newValue);
        } else {
          currentValue = newValue;
        }
      });
    },
    updateValue: (value: ValueOnKey<Value, Key>) => {
      let parentValue = parentInternal.getLatestValue()[0];
      if (
        !parentValue ||
        !areElementsEqual(parentValue[key as any], value, key)
      ) {
        parentValue = dublicateValue(
          parentValue,
          options.__isArray || Array.isArray(parentValue)
        );
        parentValue[key as any] = value;
      }

      parentInternal.updateValue(parentValue);
      return value;
    },
  });

  const createChildSubscriber = <Key extends KeyOf<Value>>(
    key: Key,
    getParentSubscriber: () => Subscription<
      (currentValue: Value, ...params: SetterParams) => Value
    >,
    childInternal: MiniContextSubscraberValue<[ValueOnKey<Value, Key>]>
  ) => (): Subscription<
    (
      currentValue: ValueOnKey<Value, Key>,
      ...params: ElementSetterParams
    ) => ValueOnKey<Value, Key>
  > => {
    const subscriber = getParentSubscriber();
    const meta = subscriber.getMetaData() as any;
    if (meta.keySubscribers && meta.keySubscribers[key]) {
      return meta.keySubscribers[key].subscriber;
    } else {
      const newMeta = { ...meta };
      if (meta.keySubscribers) {
        newMeta.keySubscribers = { ...meta.keySubscribers };
      } else newMeta.keySubscribers = {};
      const keySubscriber = new Subscription<
        (
          currentValue: ValueOnKey<Value, Key>,
          ...params: ElementSetterParams
        ) => ValueOnKey<Value, Key>
      >({});
      newMeta.keySubscribers[key] = {
        subscriber: keySubscriber,
        internal: childInternal,
      };
      subscriber.setMetaData(newMeta);
      return keySubscriber;
    }
  };

  const createChildContextValue = <Key extends KeyOf<Value>>(
    key: Key,
    contextValue: ContextValue<Value, SetterParams>
  ): ContextValue<ValueOnKey<Value, Key>, SetterParams> => {
    const internal = createChildInternal(key, contextValue.internal);
    return {
      internal,
      getSubscriber: createChildSubscriber(
        key,
        contextValue.getSubscriber,
        internal
      ),
    };
  };

  const createChildSelectorHook = <Key extends KeyOf<Value>>(
    key: Key,
    parentSelector: ContextSelectorHook<[Value]>
  ) =>
    parentSelector.extendHook(
      (value) => [value[key as any]] as [ValueOnKey<Value, Key>]
    );

  const parentHelpers = (parent as any).__internal as Internalss<
    Value,
    SetterParams
  >;

  const createHooksOnKey = <Key extends KeyOf<Value>>(key: Key) => {
    const useSelector = createChildSelectorHook(key, parent.useSelector);

    return getHelperHooks<
      ValueOnKey<Value, Key>,
      any,
      false,
      ElementSetterParams
    >({
      useSelector,
      options,
      useContextValue: () => {
        const parentVal = parentHelpers.useContextValue();
        return useMemo(() => createChildContextValue(key, parentVal), [
          parentVal,
        ]);
      },
      useOnUnmount: () => {
        const {
          internal: parentInternal,
          getSubscriber: getParentSubscriber,
        } = parentHelpers.useContextValue();
        return useCallback(
          ({ subscriber }) => {
            const getParentUpdatetValue = () =>
              getParentNewValue(
                parentInternal.getLatestValue()[0],
                getParentSubscriber(),
                (value, k, { internal }) => {
                  return internal.getLatestValue()[0];
                }
              );
            (parentInternal as any).debouncedUpdateValue(getParentUpdatetValue);
          },
          [getParentSubscriber, parentInternal]
        );
      },
      subReducerInfo: { key },
    });
  };

  const createGlobalsOnKey = <Key extends KeyOf<Value>>(
    key: Key,
    mainContextValue?: ContextValue<Value, SetterParams>
  ) => {
    const globalContextValue = createChildContextValue(
      key,
      mainContextValue || parentHelpers.mainContextValue
    );

    return getHelperGlobals<
      ValueOnKey<Value, Key>,
      any,
      false,
      ElementSetterParams
    >({
      options,
      getGlobalContextValue: () => globalContextValue,
      subReducerInfo: { key },
    });
  };

  const useKey = <Key extends KeyOf<Value>>(key: Key) => {
    return useMemo(() => createHooksOnKey(key), [key]);
  };

  const onGlobalKey = <Key extends KeyOf<Value>>(
    key: Key
  ): StaflyCommonFunctions<
    ValueOnKey<Value, Key>,
    any,
    false,
    SetterParams
  > => {
    return createGlobalsOnKey(key);
  };

  const useKeyHooksGetter = () => {
    const hooksByKeys = useRef(
      {} as {
        [key in keyof Value]: StaflyCommonHooks<
          Value[key],
          any,
          false,
          ElementSetterParams
        >;
      }
    );
    return useCallback(<Key extends KeyOf<Value>>(key: Key) => {
      if (!hooksByKeys.current[key as any]) {
        hooksByKeys.current[key as any] = createHooksOnKey(key);
      }
      return hooksByKeys.current[key as any];
    }, []);
  };

  const useKeyFunctionsGetter = () => {
    const hooksByKeys = useRef(
      {} as {
        [Key in keyof Value]: StaflyCommonFunctions<
          ValueOnKey<Value, Key>,
          any,
          false,
          SetterParams
        >;
      }
    );
    const parentVal = parentHelpers.useContextValue();
    return useCallback(
      <Key extends KeyOf<Value>>(key: Key) => {
        if (!hooksByKeys.current[key as any]) {
          hooksByKeys.current[key as any] = createGlobalsOnKey(key, parentVal);
        }
        return hooksByKeys.current[key as any];
      },
      [parentVal]
    );
  };

  const addReducers = (reducers): any => {
    (options as any).reducers = { ...(options as any).reducers, ...reducers };
    return stafly;
  };

  const addKeyReducers = (keyReducers): any => {
    (options as any).keyReducers = {
      ...(options as any).keyReducers,
      ...keyReducers,
    };
    return stafly;
  };

  const stafly: MultiStafly<Value, Reducers, ElementReducers, SetterParams> = {
    ...parent,
    addReducers,
    useKey,
    onGlobalKey,
    useKeyHooksGetter,
    useKeyFunctionsGetter,
    addKeyReducers,
  };

  delete (stafly as any).asArray;
  delete (stafly as any).asMultiKey;

  return stafly;
}

/* const globalFnsToRegularFnNames = <
  Value,
  Reducers extends AnyReducerObject<Value>,
  SetterParams extends any[]
>(
  global: CommonStaflyFns<Value, Reducers, false, SetterParams>
): CommonStaflyFns<Value, Reducers, false, SetterParams> => ({
  dispatch: global.globallyDispatch,
  getValue: global.getGlobalValue,
  setValue: global.setGlobalValue,
  subscribeToValueChange: global.subscribeToGlobalValueChange,
  registerValueSetter: global.registerGlobalValueSetter,
}); */

const dublicateValue = <T>(
  value: T | undefined,
  isArray: boolean | undefined
): T => {
  if (!value) {
    if (isArray) return [] as any;
    return {} as any;
  }
  return Object.assign(isArray ? [] : {}, value);
};

interface SubReducerInfo {
  key: string | number | symbol;
}

const createReducer = <Value>(
  internal: MiniContextSubscraberValue<[Value]>,
  reducerName: string,
  options: any,
  subReducerInfo?: SubReducerInfo
) => {
  return (...params: any[]) => {
    const reducer = subReducerInfo
      ? (options.keyReducers as AnyKeyReducerObject<any, any>)[reducerName]!
      : (options.reducers as AnyReducerObject<Value>)[reducerName]!;
    const currentValue = internal.getLatestValue()[0];
    const modifiedReducer = getModifiedReducer<Value>(
      reducer,
      params,
      options,
      subReducerInfo
    );
    const newValue = modifiedReducer(currentValue);
    internal.updateValue(newValue);
    return internal.getLatestValue();
  };
};

const getModifiedReducer = <Value = any>(
  reducer:
    | AnyKeyReducerObject<any, any>[string]
    | AnyReducerObject<any>[string],
  params: any[],
  options: any,
  subReducerInfo?: SubReducerInfo
): ((value: Value) => Value) => {
  const setterModifier = options.setterModifier || ((fn) => fn);
  if (subReducerInfo) {
    return setterModifier(
      (value) => (reducer as any)(subReducerInfo.key, value, ...params),
      options
    );
  }
  return setterModifier((value) => (reducer as any)(value, ...params), options);
};

type DefaultValue = undefined;
const stuffDefaultValue: DefaultValue = undefined;

export interface StaflyCommonHooks<
  Value,
  Reducers extends
    | AnyReducerObject<Value>
    | AnyKeyReducerObject<any, any> = EmptyObject,
  AreReducersTopLevel extends boolean = true,
  SetterParams extends any[] = []
> {
  useValue: () => Value;
  useValueGetterFn: () => (...params: SetterParams) => Value;
  useSetValue: SingleSetValue<Value>;
  useValueSetterFn: () => SetterFn<Value>;
  useRegisterValueSetter: (
    fn: (currentValue: Value, ...args: SetterParams) => Value
  ) => void;
  useSelector: ContextSelectorHook<[Value]>;
  useDispatcher: UseDispatcher<Value, Reducers, AreReducersTopLevel>;
  useSubscriber: ChangeSubscriber<Value, void>;
  useSubscriberFn: () => ChangeSubscriber<Value>;
}

export interface StaflyCommonFunctions<
  Value,
  Reducers extends
    | AnyReducerObject<Value>
    | AnyKeyReducerObject<any, any> = EmptyObject,
  AreReducersTopLevel extends boolean = true,
  SetterParams extends any[] = []
> {
  getValue: (...params: SetterParams) => Value;
  setValue: SetterFn<Value>;
  registerValueSetter: (
    fn: (currentValue: Value, ...args: SetterParams) => Value
  ) => () => void;
  subscribeToValueChange: ChangeSubscriber<Value>;
  dispatch: UseDispatcher<Value, Reducers, AreReducersTopLevel>;
}

interface SingleStafly<
  Value,
  Reducers extends AnyReducerObject<Value> = EmptyObject,
  SetterParams extends any[] = []
> extends StaflyCommonHooks<Value, Reducers, true, SetterParams> {
  Provider: React.ComponentType;
  globally: StaflyCommonFunctions<Value, Reducers, true, SetterParams>;
  addReducers: <AdditionalReducers extends AnyReducerObject<Value>>(
    reducers: AdditionalReducers
  ) => SingleStafly<Value, Reducers & AdditionalReducers, SetterParams>;
  asArray: (options?: {
    elementEqualityFn?: ElementEqualityFn<Value>;
  }) => MultiStafly<Value, Reducers, EmptyObject, SetterParams>;
  asMultiKey: (options?: {
    elementEqualityFn?: ElementEqualityFn<Value>;
  }) => MultiStafly<Value, Reducers, EmptyObject, SetterParams>;
}

type UseDispatcher<
  Value,
  Reducers extends AnyReducerObject<Value> | AnyKeyReducerObject<any, Value>,
  AreReducersTopLevel extends boolean = true
> = <ReducerName extends keyof Reducers>(
  reducerName: ReducerName
) => (
  ...args: AreReducersTopLevel extends true
    ? ParametersExceptFirst<Reducers[ReducerName]>
    : ParametersExceptFirstTwo<Reducers[ReducerName]>
) => void;

type ParametersExceptFirst<Fn> = Fn extends (
  value: any,
  ...args: infer R
) => void
  ? R
  : never;

type ParametersExceptFirstTwo<Fn> = Fn extends (
  key: any,
  value: any,
  ...args: infer R
) => void
  ? R
  : never;

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

const createEqualityFnForContext = <Value>(
  fn: (value1: Value, value2: Value) => boolean
) => {
  return function (deps1: [Value], deps2: [Value]): boolean {
    return fn(deps1[0], deps2[0]);
  };
};

interface MultiStafly<
  Value,
  Reducers extends AnyReducerObject<Value> = EmptyObject,
  ElementReducers extends AnyElementReducerObject<Value> = EmptyObject,
  SetterParams extends any[] = []
> extends StaflyCommonHooks<Value, Reducers, true, SetterParams> {
  globally: StaflyCommonFunctions<Value, Reducers, true, SetterParams>;
  useKey: <Key extends KeyOf<Value>>(
    key: Key
  ) => StaflyCommonHooks<
    ValueOnKey<Value, Key>,
    ElementReducers,
    false,
    SetterParams
  >;
  useKeyFunctionsGetter: () => <Key extends KeyOf<Value>>(
    key: Key
  ) => StaflyCommonFunctions<
    ValueOnKey<Value, Key>,
    ElementReducers,
    false,
    SetterParams
  >;
  useKeyHooksGetter: () => <Key extends KeyOf<Value>>(
    key: Key
  ) => StaflyCommonHooks<
    ValueOnKey<Value, Key>,
    ElementReducers,
    false,
    SetterParams
  >;
  onGlobalKey: <Key extends KeyOf<Value>>(
    key: Key
  ) => StaflyCommonFunctions<
    ValueOnKey<Value, Key>,
    ElementReducers,
    false,
    SetterParams
  >;
  Provider: React.ComponentType;
  addReducers: <AdditionalReducers extends AnyReducerObject<Value>>(
    reducers: AdditionalReducers
  ) => MultiStafly<
    Value,
    Reducers & AdditionalReducers,
    ElementReducers,
    SetterParams
  >;
  addKeyReducers: <AdditionalReducers extends AnyElementReducerObject<Value>>(
    reducers: AdditionalReducers
  ) => MultiStafly<
    Value,
    Reducers,
    ElementReducers & AdditionalReducers,
    SetterParams
  >;
}

export type KeyOf<Obj> = Obj extends readonly any[] ? number : keyof Obj;

export type ValueOnKey<Value, Key> = Value extends undefined | null
  ? Value
  : Value extends readonly any[]
  ? Key extends keyof Value
    ? Value[Key] | undefined
    : never
  : Value[Key & keyof Value];
