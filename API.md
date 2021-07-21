# API



<details>
  <summary>Get/Set global value even outside from components</summary>

```ts
const NameStore = createStore({
  defaultValue: "",
}).addReducers({
  addSuffix: (state, suffix: string) => state + suffix
});

///....

NameStore.globally.getValue(); // returns current global value

NameStore.globally.setValue("newName"); // sets global value
// or pass a function
NameStore.globally.setValue(name => name + "$"); // adds dollar sign to global value

NameStore.globally.dispatch("addSuffix")("$");

const unsubscribe = NameStore.globally.subscribeToValueChange((name) => {
  console.log("name changed to", name);
});

NameStore.globally.registerValueSetter(() => Math.random() + ""); // when getValue is called, random name will be set to global state
```
</details>


<details>
  <summary>Persist global state</summary>

First, we need to use higher order function `staflyFactory`, which returns `createStore` function. This way, you can write the logic once and use custom creation of store anywhere. 

Somehwere in your file write
```ts

import { staflyFactory, AnyStafly } from "stafly";

export const createCustomStaflyStore = staflyFactory({
  onAfterCreation: (stafly, options: { storageKey?: string }) => { // we can receive custom options when stafly store will be created. Let's receive storageKey and make it optional
    if (options.storageKey) persistState(stafly, options.storageKey);
    // you can have other side effects too
  },
});

const persistState = (stafly: AnyStafly, key: string) => {
  const rawValue = localStorage.getItem(key);  // get value from storage
  if (rawValue !== null) {
    try {
      const value = JSON.parse(rawValue);
      stafly.globally.setValue(value); // update stafly store global value
    } catch (e) {}
  }
  stafly.globally.subscribeToValueChange((changedValue) => {
    localStorage.setItem(key, JSON.stringify(changedValue)); // update value in storage
  });
};
```

In other files, you can use `createCustomStaflyStore` function instead of `createStore` provided by default
```ts
import { createCustomStaflyStore } from "../custom-store";

const NameStore = createCustomStaflyStore({
  defaultValue: "",
  storageKey: "__name"
});
```
Now when we update global value in the NameStore, it will be saved in the localStorage on the key `__name`. When page is reloaded, value from localStorage will be preserved and set as global value

Using factory and onAfterCreation helper function, you can write any custom logic. For example, share state between tabs by notifying when storage value from other tab is changed and then hanle new data by updating store value.

</details>

<details>
  <summary>Connecting to Immer</summary>

First, let's use `staflyFactory` to get custom store creator function
```ts
import produce from "immer";
import { staflyFactory } from "stafly";

export const createCustomStaflyStore = staflyFactory({
  setterModifier: (modifierFn) => (value) => {
    if (value === null || typeof value !== "object") return modifierFn(value); // no need to call immer if the value is not an object
    return produce(value, modifierFn);
  },
});
```

```ts
import { createCustomStaflyStore } from "../custom-store";

const UserStore = createCustomStaflyStore({
  defaultValue: {
    firstname: "",
    lastname: ""
  }
});

// You won't need to worry about mutation after that at all
UserStore.globally.setValue(user => {
  user.firstname = "!!";
  return user; 
});
```
Same goes to reducers. setterModifier will affect there too.

</details>

<details>
  <summary>Collecting data from multiple places</summary>

You might have an array of uncontrollable components and need to collect data from them.
```ts
import { createStore } from "stafly";

const NameStore = createStore({
  defaultValue: [] as string[],
}).asArray();

```

Then, in the children, you can use all the hooks by index

```ts
const Item = ({ index }) => {
  const [name, setName] = useState("");

  NameStore.useKey(index).useSetValue(name);

  // rest component...

```

That's it! Whenever you will try to get the value from the store, you will get an array, which consists of values received from `Item` components.

Now, if you want to use an object instead of an array, use `asMultiKey`:

```ts

const NameStore = createStore({
  defaultValue: {} as Record<string, string>,
}).asMultiKey();
```
```ts
const Item = ({ id }) => {
  const [name, setName] = useState("");

  NameStore.useKey(id).useSetValue(name);

  // rest component...

```

You can set reducers for elements too.

```ts
const NameStore = createStore({
  defaultValue: [] as string[],
}).asArray()
  .addKeyReducers({
    addSuffix: (index, value, suffix: string) => {
      return value + suffix;
    },
  });
```

```ts
const Item = ({ index }) => {
  const [name, setName] = useState("");

  const addSuffix = NameStore.useKey(index).useDispatcher("addSuffix");
  
  const addDollarSign = () => handleAddPrefix("$");

  // rest component...
```
<br />

If you want to do the same from Ancestor,

```ts
const Ancenstor = staflySky(NameStore)(props => {
  const getFunctionsByIndex = NameStore.useKeyFunctionsGetter();

  const handleAddingDollarSign = (index: number) => {
    getFunctionsByIndex(index).dispatch("addSuffix")("$");
  }

  // rest component...
});
```

Or in case of global function,

```ts

const handleAddingDollarSign = (index: number) => {
  NameStore.onGlobalKey(index).dispatch("addSuffix")("$");
}
```

<br />

And one more thing.
Sometimes you might prefer to pass the hooks directly to child components for achieving more abstract code.

```tsx
const Parent = staflySky(NameStore)(props => {
  const [itemsCount, setItemsCount] = useState(1);

  const getHooksByIndex = NameStore.useKeyHooksGetter();

  return (
    <div>
      {new Array.fill(itemsCount).fill(0).map((_, index) => (
          <Child hooks={getHooksByIndex(index)} />
      ))}
    </div>
  );
});

const Child = ({ hooks }) => {
  const [name, setName] = useState("");

  hooks.useSetValue(name);

  const addSuffix = hooks.useDispatcher("addSuffix");
  
  const addDollarSign = () => handleAddPrefix("$");

  // rest component...
};
```

</details>