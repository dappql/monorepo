import { useState, useEffect, useCallback, useMemo } from 'react'

/**
 * A hook for managing an array of strings in localStorage with automatic syncing across tabs
 * @param key The localStorage key to store the array under
 * @param initialValue Optional initial array of strings (defaults to empty array)
 * @returns Object containing the array and methods to manipulate it
 *
 * @example
 * const { items, addItem, removeItem, hasItem } = useStorageStringList('my-items')
 *
 * // Add a new item
 * addItem('new-item')
 *
 * // Remove an item
 * removeItem('item-to-remove')
 *
 * // Check if item exists
 * if (hasItem('some-item')) {
 *   // do something
 * }
 */
export function useStorageStringList(key: string, initialValue: string[] = []) {
  const readValue = useCallback(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      return initialValue
    }
  }, [key])

  const [storedValue, setStoredValue] = useState<string[]>(readValue)

  const setValue = useCallback(
    (value: string[]) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value))
        setStoredValue(value)
      } catch (error) {
        console.log(error)
      }
    },
    [key],
  )

  /**
   * Adds a string to the array if it doesn't already exist
   */
  const addItem = useCallback(
    (item: string) => {
      if (!storedValue.includes(item)) {
        setValue([...storedValue, item])
      }
    },
    [storedValue, setValue],
  )

  /**
   * Removes a string from the array if it exists
   */
  const removeItem = useCallback(
    (item: string) => {
      setValue(storedValue.filter((i) => i !== item))
    },
    [storedValue, setValue],
  )

  /**
   * Checks if a string exists in the array
   */
  const hasItem = useCallback((item: string) => storedValue.includes(item), [storedValue])

  useEffect(() => {
    const handleStorageChange = () => {
      setStoredValue(readValue())
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [readValue])

  return useMemo(
    () => ({
      items: storedValue,
      setItems: setValue,
      addItem,
      removeItem,
      hasItem,
    }),
    [storedValue, setValue, addItem, removeItem, hasItem],
  )
}

/**
 * Return type of the useStorageStringList hook
 */
export type LocalStorage = ReturnType<typeof useStorageStringList>
