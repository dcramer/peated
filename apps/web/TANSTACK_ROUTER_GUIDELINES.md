# TanStack Router Guidelines

## **Route Structure Patterns**

### **1. Simple Content Pages**

Wrap component directly with layout:

```tsx
// about.tsx, favorites.tsx, friends.tsx
export const Route = createFileRoute("/about")({
  component: () => (
    <DefaultLayout>
      <AboutContent />
    </DefaultLayout>
  ),
});
```

### **2. Parent-Child Relationships**

Parent route = Layout + `<Outlet />`, children inherit automatically:

```tsx
// bottles.$bottleId.tsx (Parent - Layout)
function BottleLayout() {
  return (
    <DefaultLayout>
      <BottleHeader />
      <BottleTabs />
      <Outlet /> {/* Child routes render here */}
    </DefaultLayout>
  );
}

// bottles.$bottleId.index.tsx (Child - Default content)
function BottleOverview() {
  return <BottleDetails />; // No layout wrapper - inherits parent
}

// bottles.$bottleId.prices.tsx (Child - Tab content)
function BottlePrices() {
  return <PricesList />; // No layout wrapper - inherits parent
}
```

### **3. Index Routes**

Always create index routes for parent URLs that have children:

- `bottles.$bottleId.tsx` → needs `bottles.$bottleId.index.tsx`
- `users.$username.tsx` → needs `users.$username.index.tsx`

## **Layout Types**

| Layout                  | Usage                            |
| ----------------------- | -------------------------------- |
| `defaultLayout`         | Most content pages               |
| `bottlesSidebarLayout`  | Bottles list only                |
| `entitiesSidebarLayout` | Brands/distillers/bottlers lists |
| `adminLayout`           | Admin routes (auth wrapper)      |
| No wrapper              | Auth, modals, edit forms         |

## **Examples**

```tsx
// List with sidebar
export const Route = createFileRoute("/bottles")({
  component: () => (
    <BottlesSidebarLayout>
      <BottlesList />
    </BottlesSidebarLayout>
  ),
});

// Detail with tabs (parent)
export const Route = createFileRoute("/bottles/$bottleId")({
  component: BottleLayout, // Has <Outlet />
});

// Detail default content (index)
export const Route = createFileRoute("/bottles/$bottleId/")({
  component: BottleOverview, // No wrapper - inherits
});

// Admin route
export const Route = createFileRoute("/admin/badges")({
  component: () => (
    <AdminLayout>
      <BadgesList />
    </AdminLayout>
  ),
});

// Layout-free route
export const Route = createFileRoute("/login")({
  component: LoginForm, // No wrapper
});
```

## **What We Don't Use**

- ❌ **Pathless layout routes** (`_layout.tsx`) - We wrap components directly
- ❌ **Route groups** (`(admin)/`) - We use flat file structure
- ❌ **Changing route paths** - We use TanStack Router's URL patterns as-is

## **File Naming**

- Parent: `bottles.$bottleId.tsx`
- Index: `bottles.$bottleId.index.tsx`
- Children: `bottles.$bottleId.prices.tsx`

The [TanStack Router routing concepts](https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts#index-routes) provide the foundation, but we follow the **layout inheritance pattern** where parent routes define layouts and children automatically inherit them.
