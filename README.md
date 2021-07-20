# Stafly - Fly your state anywhere 🕊

Stafly is a state management tool for react

Let's start with a **global state**.

```ts
import { createStafly } from "stafly";

const NameStore = createStafly<string>();

const Ancenstor = props => {
  const name = NameStore.useValue();

  // rest component...

```
```ts
const Descendant = props => {
  const [name, setName] = useState("");

  NameStore.useSetValue(name);

  // rest component...

```
Done!
We can get or set value from any component

<br /><br />

You might not need global state is some cases (for example, if we use Ancestor component at sveeral places), so sometimes we need to limit our flight. They say, sky is the limit, so let's wrap our Ancestor component


```ts
const Ancenstor = staflySky(NameStore)(props => {
  // rest component ...
});
```

That's it! Now we can render Ancenstor at multiple places and they will have separate states.  No more singleton.

You can pass multiple stores to staflySky function.
You can use `staflySky.memo` instead of `staflySky` to memoize component, just as `React.memo` would do.


Sometimes we might not neet to have up to date value of the store, but just access it whenever needed.

```ts
const Ancenstor = staflySky.memo(NameStore)(props => {
  const getName = NameStore.useValueGetterFn();

  const onSubmit = () => {
    const name = getName();
    // rest logic
  }

  // rest component...

```
In this case, Ancestor will not rerender on every change of value.

You can get setter function too 
```ts
const Ancenstor = props => {
  const setName = NamesStore.useValueSetterFn();
  
  // rest component...
```

When creating stafly, you can pass default value too:

```ts
const NameStore = createStafly({
  defaultValue: ""
});
```

You can add reducers to move state change logic away from components

```ts
const NameStore = createStafly({
  defaultValue: ""
}).addReducers({
  reset: (state) => "",
  addSuffix: (state, suffix: string) => state + suffix
});


const Ancestor = props => {

  const handleReset = NameStore.useDispatcher("reset");
  const handleAddPrefix = NameStore.useDispatcher("addSuffix");

  const addDollarSign = () => handleAddPrefix("$");

  const cleanup = () => {
    handleReset();
    // rest code
  }

```

You can subscribe to value change.
```ts
const Ancestor = props => {
    NameStore.useSubscriber((newName) => {
      // perform operations
    });

    // alternatively, if you want to manually control subscription and unsubscription, then you can write:

    const subscribe = NameStore.useSubscriberFn();

    useEffect(() => {
      const unsubscribe = subscribe(() => {
        // perform operations
      });

      return unsubscribe; // for cleanup
    }, [subscribe]);

    // rest component...
```

If you are saving complex and/or fast changing data in the store, sometimes you might not want to have up to date information for optimization purposes.
You can not only get data when needed, but also set data in the store when requested.
For that, you can register setter on the store.

```jsx
const Descendant = props => {
  const [name, setName] = useState("");
  const inputRef = useRef();

  NamesStore.useRegisterValueSetter(() => inputRef.current.value);

  return <input defaultValue="" ref={inputRef} />
```

In this case, you will no longer have up to date value in the store, but when requested by value getter function, registered setter function will be called and you will get newest data. The value in the store will be updated too.


For advanced uses, such as accessing and modifying global state outside components, persisting state, using `immer`, gathering data from multiple places and more, please see the rest of the documentation here.