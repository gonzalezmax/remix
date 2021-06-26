import { Location } from "history";
import { createTransitionManager } from "../transition";
import type { TransitionManagerInit } from "../transition";

let routes = [
  {
    path: "/",
    id: "root",
    loader: async () => "ROOT",
    action: async () => "ROOT",
    element: {},
    children: [
      {
        path: "a",
        id: "routes/a",
        loader: async () => ({ fakeLoaderDataFor: "routes/a" }),
        action: async () => ({ fakeActionDataFor: "routes/a" }),
        element: {}
      }
    ]
  }
];

let fakeKey = 0;
function createLocation(path: string, state: any = null): Location {
  let [pathname, search] = path.split("?");
  return {
    pathname,
    search: search ? `?${search}` : "",
    hash: "",
    key: String(++fakeKey),
    state
  };
}

function createTestTransitionManager(
  pathname: string,
  init?: Partial<TransitionManagerInit>
) {
  let location = createLocation(pathname);
  return createTransitionManager({
    actionData: undefined,
    loaderData: { root: "ROOT" },
    location,
    routes,
    onChange() {},
    onRedirect() {},
    ...init
  });
}

describe("transition emulator", () => {
  let parentLoader: jest.Mock<string>;
  let childLoader: jest.Mock<string>;
  let paramLoader: jest.Mock<string>;
  let tm: ReturnType<typeof createTestTransitionManager>;

  beforeEach(() => {
    fakeKey = 0;
    parentLoader = jest.fn(() => "PARENT");
    childLoader = jest.fn(() => "CHILD");
    paramLoader = jest.fn(() => "PARAM");
    tm = createTestTransitionManager("/", {
      loaderData: { parent: "PARENT" },
      routes: [
        {
          path: "/",
          id: "parent",
          loader: parentLoader,
          element: {},
          children: [
            {
              path: "a",
              id: "child",
              loader: childLoader,
              element: {}
            },
            {
              path: "p/:param",
              id: "param-child",
              loader: paramLoader,
              element: {}
            }
          ]
        }
      ]
    });
  });

  it("initializes state", async () => {
    expect(tm.getState()).toMatchInlineSnapshot(`
      Object {
        "actionData": undefined,
        "error": undefined,
        "errorBoundaryId": undefined,
        "loaderData": Object {
          "parent": "PARENT",
        },
        "location": Object {
          "hash": "",
          "key": "1",
          "pathname": "/",
          "search": "",
          "state": null,
        },
        "matches": Array [
          Object {
            "params": Object {},
            "pathname": "/",
            "route": Object {
              "children": Array [
                Object {
                  "element": Object {},
                  "id": "child",
                  "loader": [MockFunction],
                  "path": "a",
                },
                Object {
                  "element": Object {},
                  "id": "param-child",
                  "loader": [MockFunction],
                  "path": "p/:param",
                },
              ],
              "element": Object {},
              "id": "parent",
              "loader": [MockFunction],
              "path": "/",
            },
          },
        ],
        "nextLocation": undefined,
        "nextMatches": undefined,
        "pendingSubmissions": Map {},
        "refActionData": Map {},
      }
    `);
  });

  it("updates state immediately after a new location comes through", () => {
    tm.send(createLocation("/a"));
    let state = tm.getState();
    expect(state.nextLocation.pathname).toBe("/a");
    expect(state.nextMatches.length).toBe(2);
  });

  describe("GET navigation", () => {
    it("fetches data on new locations", async () => {
      await tm.send(createLocation("/a"));
      let state = tm.getState();
      expect(state.loaderData).toMatchInlineSnapshot(`
        Object {
          "child": "CHILD",
          "parent": "PARENT",
        }
      `);
    });

    describe("parent -> child transition", () => {
      it("only fetches child data", async () => {
        await tm.send(createLocation("/a"));
        let state = tm.getState();
        expect(parentLoader.mock.calls.length).toBe(0);
        expect(state.loaderData).toMatchInlineSnapshot(`
          Object {
            "child": "CHILD",
            "parent": "PARENT",
          }
        `);
      });
    });

    describe("search change", () => {
      it("reloads all routes", async () => {
        await tm.send(createLocation("/a?foo"));
        expect(parentLoader.mock.calls.length).toBe(1);
        expect(childLoader.mock.calls.length).toBe(1);

        await tm.send(createLocation("/a?bar"));
        expect(parentLoader.mock.calls.length).toBe(2);
        expect(childLoader.mock.calls.length).toBe(2);
      });
    });

    describe("param change", () => {
      it("reloads only routes with changed params", async () => {
        await tm.send(createLocation("/p/one"));
        expect(parentLoader.mock.calls.length).toBe(0);
        expect(paramLoader.mock.calls.length).toBe(1);

        await tm.send(createLocation("/p/two"));
        expect(parentLoader.mock.calls.length).toBe(0);
        expect(paramLoader.mock.calls.length).toBe(2);
      });
    });

    describe("same url", () => {
      it("reloads all routes", async () => {
        await tm.send(createLocation("/p/one"));
        expect(parentLoader.mock.calls.length).toBe(0);
        expect(paramLoader.mock.calls.length).toBe(1);

        await tm.send(createLocation("/p/one"));
        expect(parentLoader.mock.calls.length).toBe(1);
        expect(paramLoader.mock.calls.length).toBe(2);
      });

      describe("on push", () => {
        it.todo("reloads all data");
      });

      describe("on pop", () => {
        it.todo("uses cache"); // oof, not sure we want to bring this back!
      });
    });

    it.todo("delegates to the route if it should reload or not");
  });

  describe("actions", () => {
    describe("after an action", () => {
      let parentLoader: jest.Mock;
      let parentAction: jest.Mock;
      let childLoader: jest.Mock;
      let childAction: jest.Mock;
      let tm: ReturnType<typeof createTestTransitionManager>;

      beforeEach(() => {
        parentLoader = jest.fn(() => "PARENT");
        childLoader = jest.fn(() => "CHILD");
        parentAction = jest.fn(() => "PARENT");
        childAction = jest.fn(() => "CHILD");
        tm = createTestTransitionManager("/", {
          loaderData: { parent: "PARENT" },
          routes: [
            {
              path: "/",
              id: "parent",
              element: {},
              loader: parentLoader,
              action: parentAction
            },
            {
              path: "/child",
              id: "child",
              element: {},
              loader: childLoader,
              action: childAction
            }
          ]
        });
      });

      it.only("calls only the leaf route action", async () => {
        await tm.send(createLocation("/child", { isAction: true }));
        expect(parentAction.mock.calls.length).toBe(0);
        expect(childAction.mock.calls.length).toBe(1);
      });

      it.todo("reloads all data after the action");
      it.todo("reloads all data after action redirect");
    });

    describe("errors", () => {
      describe("with an error boundary in the action route", () => {
        it.todo("uses the action route's error boundary");
        it.todo("loads parent data, but not action data");
      });
      describe("with an error boundary above the action route", () => {
        it.todo("uses the nearest error boundary");
        it.todo("only loads data above error boundary route");
      });
    });
  });

  describe("redirects", () => {
    it.todo("redirects");
  });

  describe("actions with refs", () => {
    it.todo("tracks pending submissions by ref");
    it.todo("tracks action data by ref");
  });

  // describe("navigations while pending", () => {
  //   describe(`
  //     GET /a
  //     GET /a
  //   `, () => {
  //     describe(`
  //       A) GET /a |------X
  //       B) GET /a   |------O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });

  //     describe(`
  //       A) GET /a |----------X
  //       B) GET /a   |------O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });
  //   });

  //   describe(`
  //     GET /a
  //     GET /b
  //   `, () => {
  //     describe(`
  //       A) GET /a |------X
  //       B) GET /b    |------O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });
  //     describe(`
  //       A) GET /a |------------X
  //       B) GET /b    |------O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });
  //   });

  //   describe(`
  //     GET /a > 303 /c
  //     GET /b
  //   `, () => {
  //     describe(`
  //       A) GET /a |-------/c--X
  //       B) GET /b   |---O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });

  //     describe(`
  //       A) GET /a |-------/c--X
  //       B) GET /b   |---------------O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });

  //     describe(`
  //       A) GET /a |--/c--------X
  //       B) GET /b           |---O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });

  //     describe(`
  //       A) GET /a |--/c--------X
  //       B) GET /b           |---------O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });
  //   });

  //   describe(`
  //     GET /a > 303 /b
  //     GET /b
  //   `, () => {
  //     describe(`
  //       A) GET /a |-------/b--X
  //       B) GET /b   |---O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });

  //     describe(`
  //       A) GET /a |-------/b--X
  //       B) GET /b   |---------------O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });

  //     describe(`
  //       A) GET /a |--/b--------X
  //       B) GET /b            |---O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });

  //     describe(`
  //       A) GET /a |--/b3--------X
  //       B) GET /b            |---------O
  //     `, () => {
  //       it.todo("aborts A, commits B");
  //     });
  //   });

  //   describe(`
  //     POST /a
  //     POST /a
  //   `, () => {
  //     describe(`
  //       A) POST /a |----|----O
  //       B) POST /a    |----|----O
  //     `, () => {
  //       it.todo("commits A, commits B");
  //     });

  //     describe(`
  //       A) POST /a |----|----------X
  //       B) POST /a    |----|----O
  //     `, () => {
  //       it.todo("commits B, aborts A");
  //     });

  //     describe(`
  //       A) POST /a |-----------|---O
  //       B) POST /a    |----|-----O
  //     `, () => {
  //       it.todo("commits B, commits A");
  //     });

  //     describe(`
  //       A) POST /a |-----------|---O
  //       B) POST /a    |----|----------X
  //     `, () => {
  //       it.todo("commits A, aborts B");
  //     });
  //   });

  //   describe(`
  //     POST /a > 303 /a
  //     POST /a > 303 /a
  //   `, () => {
  //     describe(`
  //       A) POST /a |----/a----O
  //       B) POST /a    |----/a----O
  //     `, () => {
  //       it.todo("commits A, commits B");
  //     });

  //     describe(`
  //       A) POST /a |----/a----------X
  //       B) POST /a    |----/a----O
  //     `, () => {
  //       it.todo("commits B, aborts A");
  //     });

  //     describe(`
  //       A) POST /a |-----------/a---O
  //       B) POST /a    |----/a-----O
  //     `, () => {
  //       it.todo("commits B, commits A");
  //     });

  //     describe(`
  //       A) POST /a |-----------/a---O
  //       B) POST /a    |----/a----------X
  //     `, () => {
  //       it.todo("commits A, aborts B");
  //     });
  //   });

  //   describe(`
  //     @    /a
  //     POST /b > 303 /a
  //     POST /b > 303 /a
  //   `, () => {
  //     describe(`
  //       A) POST /b |----/a----O
  //       B) POST /b    |----/a----O
  //     `, () => {
  //       it.todo("commits A, commits B");
  //     });

  //     describe(`
  //       A) POST /b |----/a----------X
  //       B) POST /b    |----/a----O
  //     `, () => {
  //       it.todo("commits B, aborts A");
  //     });

  //     describe(`
  //       A) POST /b |-----------/a---O
  //       B) POST /b    |----/a-----O
  //     `, () => {
  //       it.todo("commits B, commits A");
  //     });

  //     describe(`
  //       A) POST /b |-----------/a---O
  //       B) POST /b    |----/a----------X
  //     `, () => {
  //       it.todo("commits A, aborts B");
  //     });
  //   });
  // });

  it("aborts stale data loads", async () => {
    let onChange = jest.fn();
    let tm = createTestTransitionManager("/", { onChange });

    await tm.send(createLocation("/a"));
    expect(onChange.mock.calls.length).toBe(2);

    let state = tm.getState();
    expect(state.loaderData).toMatchInlineSnapshot(`
      Object {
        "root": "ROOT",
        "routes/a": Object {
          "fakeLoaderDataFor": "routes/a",
        },
      }
    `);
  });
});