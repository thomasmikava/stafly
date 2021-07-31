/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
/* eslint-disable max-lines-per-function */
/* eslint-disable max-lines */
/* eslint-disable react-hooks/rules-of-hooks */
import React, { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, } from "react";
import { ContextSubscriber } from "react-context-subscribers";
import Subscription from "simple-subscriptions";
function staflySkyRaw(...staflys) {
    let memoized = false;
    if (staflys[0] === "memo") {
        memoized = true;
        staflys = staflys.slice(1);
    }
    return function StaflyedComponent(component) {
        const forwardedComp = React.forwardRef((props, ref) => {
            let children = React.createElement(component, Object.assign(Object.assign({}, props), { ref }));
            for (const stafly of staflys) {
                children = React.createElement(stafly.Provider, {}, children);
            }
            return children;
        });
        if (memoized)
            return React.memo(forwardedComp);
        return forwardedComp;
    };
}
const memoized = {
    memo: ((...args) => staflySkyRaw("memo", ...args)),
};
export const staflySky = Object.assign(staflySkyRaw, memoized);
//
export const createStore = (options) => {
    if (!options)
        options = {};
    return createSingleStafly(Object.assign({}, options));
};
export const staflyFactory = (settings) => {
    return ((options) => {
        let combinedOptions = Object.assign(Object.assign(Object.assign({}, (settings.options || {})), options), { setterModifier: (settings.setterModifier || options.setterModifier) });
        if (settings.modifyOptions) {
            combinedOptions = settings.modifyOptions(combinedOptions);
        }
        const stafly = createStore(combinedOptions);
        if (settings.onAfterCreation) {
            settings.onAfterCreation(stafly, Object.assign({}, combinedOptions));
        }
        return stafly;
    });
};
const throwMultipleSettersError = () => {
    throw new Error("StaflyMultipleSettersError: more than 1 value setter is attached to stafly store. If you're absolutely sure to ignore this error, pass `{ ignoreMultipleSettersError: true }` to `createStore`");
};
const getHelperHooks = ({ useSelector, options, useContextValue, useOnUnmount, subReducerInfo, }) => {
    const useValue = () => {
        return useSelector()[0];
    };
    const useValueGetterFn = () => {
        const { internal, getSubscriber } = useContextValue();
        return useCallback((...params) => {
            return getValueHelper(internal, getSubscriber, options, params);
        }, [internal, getSubscriber]);
    };
    const useRegisterOn = (internal, getSubscriber, fnRef) => {
        const onUnmount = useOnUnmount === null || useOnUnmount === void 0 ? void 0 : useOnUnmount();
        useLayoutEffect(() => {
            const subscriber = getSubscriber();
            if (subscriber.getSubscribersCount() > 0 &&
                !options.ignoreMultipleSettersError) {
                throwMultipleSettersError();
            }
            const unsubscribe = subscriber.subscribe((...args) => {
                return fnRef.current(...args);
            });
            return () => {
                unsubscribe();
                onUnmount === null || onUnmount === void 0 ? void 0 : onUnmount({ internal, subscriber });
            };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [getSubscriber, internal, onUnmount]);
    };
    const useSetValue = (vl, deps) => {
        const { internal, getSubscriber } = useContextValue();
        let newValue = vl;
        const newValueRef = useRef(newValue);
        if (typeof vl !== "function") {
            newValue = useMemo(() => vl, deps || [vl]);
        }
        else {
            newValue = useMemo(() => {
                const modifiedReducer = getModifiedReducer(vl, [], options);
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
    const useRegisterValueSetter = (fn) => {
        const { internal, getSubscriber } = useContextValue();
        const fnRef = useRef(fn);
        useLayoutEffect(() => {
            fnRef.current = (value, ...args) => {
                const finalFn = getModifiedReducer(fn, args, options);
                return finalFn(value);
            };
        }, [fn]);
        useRegisterOn(internal, getSubscriber, fnRef);
    };
    const useValueSetterFn = () => {
        const { internal } = useContextValue();
        return useCallback((vl) => {
            if (typeof vl === "function") {
                const modifiedReducer = getModifiedReducer(vl, [], options);
                vl = modifiedReducer(internal.getLatestValue()[0]);
            }
            internal.updateValue(vl);
        }, [internal]);
    };
    const useSubscriber = (fn) => {
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
    const useSubscriberFn = () => {
        const { internal } = useContextValue();
        return useCallback((fn) => {
            return internal.subscribe(fn);
        }, [internal]);
    };
    const useDispatcher = (key) => {
        const { internal } = useContextValue();
        return useCallback(createReducer(internal, key, options, subReducerInfo), [internal, key]);
    };
    const useState = () => [useValue(), useValueSetterFn()];
    return {
        useSelector,
        useValue,
        useState,
        useValueGetterFn,
        useSetValue,
        useRegisterValueSetter,
        useValueSetterFn,
        useDispatcher,
        useSubscriber,
        useSubscriberFn,
    };
};
const getValueHelper = (internal, getSubscriber, options, params) => {
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
const getHelperGlobals = ({ options, getGlobalContextValue, subReducerInfo, }) => {
    const getValue = (...params) => {
        const globalContextValue = getGlobalContextValue();
        return getValueHelper(globalContextValue.internal, globalContextValue.getSubscriber, options, params);
    };
    const registerValueSetter = (fn) => {
        const globalContextValue = getGlobalContextValue();
        const subscriber = globalContextValue.getSubscriber();
        if (subscriber.getSubscribersCount() > 0 &&
            !options.ignoreMultipleSettersError) {
            throwMultipleSettersError();
        }
        return subscriber.subscribe(fn);
    };
    /* const getCurrenetGlobalValue = (): Value => {
      return getGlobalContextValue().internal.getLatestValue()[0];
    }; */
    const setValue = (newValue) => {
        let val = newValue;
        if (typeof newValue === "function") {
            val = getModifiedReducer(val, [], options)(newValue);
        }
        getGlobalContextValue().internal.updateValue(val);
    };
    const subscribeToValueChange = (fn) => {
        return getGlobalContextValue().internal.subscribe(fn);
    };
    const dispatch = (key) => {
        const internal = getGlobalContextValue().internal;
        return createReducer(internal, key, options, subReducerInfo);
    };
    return {
        getValue,
        setValue,
        subscribeToValueChange,
        dispatch,
        registerValueSetter,
    };
};
// eslint-disable-next-line max-lines-per-function
function createSingleStafly(options) {
    const defaultValue = options.hasOwnProperty("defaultValue")
        ? options.defaultValue
        : stuffDefaultValue;
    const defaultValueGetter = (typeof defaultValue === "function"
        ? () => [defaultValue()]
        : () => [defaultValue]);
    const contextSubscriber = new ContextSubscriber(defaultValueGetter, "function", options.equalityFn
        ? createEqualityFnForContext(options.equalityFn)
        : undefined);
    const createContextValue = (isDefaultCall) => {
        const registered = isDefaultCall
            ? contextSubscriber.defaultProvider
            : contextSubscriber.registerNewProvider();
        const subscriber = new Subscription({});
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
    const helperHooks = getHelperHooks({
        useSelector: contextSubscriber.useSelector,
        options,
        useContextValue,
    });
    const globalFns = getHelperGlobals({
        options,
        getGlobalContextValue: () => mainContextValue,
    });
    const Provider = ({ children }) => {
        const [contextValue] = useState(createContextValue);
        const internal = contextValue.internal;
        useLayoutEffect(() => {
            if (options.__afterEffect) {
                options.__afterEffect(contextValue);
            }
            return () => internal.destroy();
        }, []);
        return React.createElement(MainContext.Provider, {
            value: contextValue,
        }, React.createElement(contextSubscriber.context.Provider, {
            value: internal,
            children,
        }));
    };
    const internals = {
        useContextValue,
        getGlobalInternal,
        mainContextValue,
    };
    const additionalSettings = {
        __internal: internals,
    };
    const addReducers = (reducers) => {
        options.reducers = Object.assign(Object.assign({}, options.reducers), reducers);
        return stafly;
    };
    const asArray = (additionalOptions = {}) => {
        Object.assign(options, additionalOptions);
        options.__isArray = true;
        return createMultiStaflyHelper(options, stafly);
    };
    const asMultiKey = (additionalOptions = {}) => {
        Object.assign(options, additionalOptions);
        return createMultiStaflyHelper(options, stafly);
    };
    const stafly = Object.assign(Object.assign(Object.assign({}, helperHooks), { globally: globalFns, useSelector: contextSubscriber.useSelector, Provider,
        addReducers,
        asArray,
        asMultiKey }), additionalSettings);
    return stafly;
}
function createMultiStaflyHelper(options, parent) {
    const areElementsEqual = (value1, value2, key) => {
        if (!options.elementEqualityFn) {
            return value1 === value2;
        }
        return options.elementEqualityFn(value1, value2, key);
    };
    const getParentNewValue = (value, parnetSubscriber, getKeyValue) => {
        const meta = parnetSubscriber.getMetaData();
        const keySubscribers = meta.keySubscribers;
        if (!keySubscribers)
            return value;
        const dublicated = dublicateValue(undefined, options.__isArray || Array.isArray(value));
        let isChanged = false;
        for (const key in keySubscribers) {
            const k = key;
            const child = keySubscribers[key];
            const subscriber = child.subscriber;
            let keyValue;
            if (subscriber.getSubscribersCount() === 0) {
                delete keySubscribers[key];
                delete dublicated[key];
                if (key in (value || {}))
                    isChanged = true;
            }
            else {
                keyValue = getKeyValue(value, k, child);
                if (!value || !areElementsEqual(value[key], keyValue, k)) {
                    isChanged = true;
                }
                dublicated[key] = keyValue;
            }
        }
        if (!isChanged)
            return value;
        return dublicated;
    };
    const __afterEffect = (contextValue) => {
        const subscriber = contextValue.getSubscriber();
        if (subscriber.getSubscribersCount() > 0 &&
            !options.ignoreMultipleSettersError) {
            throwMultipleSettersError();
        }
        let lastFn;
        let lastTimeout;
        contextValue.internal.debouncedUpdateValue = (fn) => {
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
            return getParentNewValue(value, subscriber, (value, key, { subscriber }) => subscriber.broadcast(value === null || value === void 0 ? void 0 : value[key], ...params)[0]);
        });
    };
    options.__afterEffect = __afterEffect;
    __afterEffect(parent.__internal
        .mainContextValue);
    const createChildInternal = (key, parentInternal) => ({
        getLatestValue: () => { var _a; return [(_a = parentInternal.getLatestValue()[0]) === null || _a === void 0 ? void 0 : _a[key]]; },
        subscribe: (fn) => {
            var _a;
            let currentValue = (_a = parentInternal.getLatestValue()[0]) === null || _a === void 0 ? void 0 : _a[key];
            return parentInternal.subscribe((newParentValue) => {
                const newValue = newParentValue === null || newParentValue === void 0 ? void 0 : newParentValue[key];
                if (!areElementsEqual(currentValue, newValue, key)) {
                    currentValue = newValue;
                    fn(newValue);
                }
                else {
                    currentValue = newValue;
                }
            });
        },
        updateValue: (value) => {
            let parentValue = parentInternal.getLatestValue()[0];
            if (!parentValue ||
                !areElementsEqual(parentValue[key], value, key)) {
                parentValue = dublicateValue(parentValue, options.__isArray || Array.isArray(parentValue));
                parentValue[key] = value;
            }
            parentInternal.updateValue(parentValue);
            return value;
        },
    });
    const createChildSubscriber = (key, getParentSubscriber, childInternal) => () => {
        const subscriber = getParentSubscriber();
        const meta = subscriber.getMetaData();
        if (meta.keySubscribers && meta.keySubscribers[key]) {
            return meta.keySubscribers[key].subscriber;
        }
        else {
            const newMeta = Object.assign({}, meta);
            if (meta.keySubscribers) {
                newMeta.keySubscribers = Object.assign({}, meta.keySubscribers);
            }
            else
                newMeta.keySubscribers = {};
            const keySubscriber = new Subscription({});
            newMeta.keySubscribers[key] = {
                subscriber: keySubscriber,
                internal: childInternal,
            };
            subscriber.setMetaData(newMeta);
            return keySubscriber;
        }
    };
    const createChildContextValue = (key, contextValue) => {
        const internal = createChildInternal(key, contextValue.internal);
        return {
            internal,
            getSubscriber: createChildSubscriber(key, contextValue.getSubscriber, internal),
        };
    };
    const createChildSelectorHook = (key, parentSelector) => parentSelector.extendHook((value) => [value[key]]);
    const parentHelpers = parent.__internal;
    const createHooksOnKey = (key) => {
        const useSelector = createChildSelectorHook(key, parent.useSelector);
        return getHelperHooks({
            useSelector,
            options,
            useContextValue: () => {
                const parentVal = parentHelpers.useContextValue();
                return useMemo(() => createChildContextValue(key, parentVal), [
                    parentVal,
                ]);
            },
            useOnUnmount: () => {
                const { internal: parentInternal, getSubscriber: getParentSubscriber, } = parentHelpers.useContextValue();
                return useCallback(({ subscriber }) => {
                    const getParentUpdatetValue = () => getParentNewValue(parentInternal.getLatestValue()[0], getParentSubscriber(), (value, k, { internal }) => {
                        return internal.getLatestValue()[0];
                    });
                    parentInternal.debouncedUpdateValue(getParentUpdatetValue);
                }, [getParentSubscriber, parentInternal]);
            },
            subReducerInfo: { key },
        });
    };
    const createGlobalsOnKey = (key, mainContextValue) => {
        const globalContextValue = createChildContextValue(key, mainContextValue || parentHelpers.mainContextValue);
        return getHelperGlobals({
            options,
            getGlobalContextValue: () => globalContextValue,
            subReducerInfo: { key },
        });
    };
    const useKey = (key) => {
        return useMemo(() => createHooksOnKey(key), [key]);
    };
    const onGlobalKey = (key) => {
        return createGlobalsOnKey(key);
    };
    const useKeyHooksGetter = () => {
        const hooksByKeys = useRef({});
        return useCallback((key) => {
            if (!hooksByKeys.current[key]) {
                hooksByKeys.current[key] = createHooksOnKey(key);
            }
            return hooksByKeys.current[key];
        }, []);
    };
    const useKeyFunctionsGetter = () => {
        const hooksByKeys = useRef({});
        const parentVal = parentHelpers.useContextValue();
        return useCallback((key) => {
            if (!hooksByKeys.current[key]) {
                hooksByKeys.current[key] = createGlobalsOnKey(key, parentVal);
            }
            return hooksByKeys.current[key];
        }, [parentVal]);
    };
    const addReducers = (reducers) => {
        options.reducers = Object.assign(Object.assign({}, options.reducers), reducers);
        return stafly;
    };
    const addKeyReducers = (keyReducers) => {
        options.keyReducers = Object.assign(Object.assign({}, options.keyReducers), keyReducers);
        return stafly;
    };
    const stafly = Object.assign(Object.assign({}, parent), { addReducers,
        useKey,
        onGlobalKey,
        useKeyHooksGetter,
        useKeyFunctionsGetter,
        addKeyReducers });
    delete stafly.asArray;
    delete stafly.asMultiKey;
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
const dublicateValue = (value, isArray) => {
    if (!value) {
        if (isArray)
            return [];
        return {};
    }
    return Object.assign(isArray ? [] : {}, value);
};
const createReducer = (internal, reducerName, options, subReducerInfo) => {
    return (...params) => {
        const reducer = subReducerInfo
            ? options.keyReducers[reducerName]
            : options.reducers[reducerName];
        const currentValue = internal.getLatestValue()[0];
        const modifiedReducer = getModifiedReducer(reducer, params, options, subReducerInfo);
        const newValue = modifiedReducer(currentValue);
        internal.updateValue(newValue);
        return internal.getLatestValue();
    };
};
const getModifiedReducer = (reducer, params, options, subReducerInfo) => {
    const setterModifier = options.setterModifier || ((fn) => fn);
    if (subReducerInfo) {
        return setterModifier((value) => reducer(subReducerInfo.key, value, ...params), options);
    }
    return setterModifier((value) => reducer(value, ...params), options);
};
const stuffDefaultValue = undefined;
const createEqualityFnForContext = (fn) => {
    return function (deps1, deps2) {
        return fn(deps1[0], deps2[0]);
    };
};
