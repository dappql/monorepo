import {
  Badge,
  createListCollection,
  Heading,
  HStack,
  Icon,
  IconButton,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
  Spinner,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import { useIteratorQuery, useMutation, useSingleQuery } from '@dappql/core'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { Address, zeroAddress } from 'viem'

import { IoIosArrowBack, IoIosArrowForward } from 'react-icons/io'
import { PiPlus } from 'react-icons/pi'
import { Button } from '~/components/ui/button'
import { ToDo } from '~/contracts'

const STATUS_IDS = {
  Pending: 1n,
  Doing: 2n,
  Done: 4n,
}

const useItems = (total: bigint, address: Address) => {
  return useIteratorQuery(total, (index: bigint) => ToDo.call.item(address, index), {
    firstIndex: 1n,
  })
}

type ToDoItemList = ReturnType<typeof useItems>['data']
type ToDoItem = ToDoItemList[number]

const statuses = createListCollection({
  items: Object.keys(STATUS_IDS).map((status) => ({
    label: status,
    value: STATUS_IDS[status as keyof typeof STATUS_IDS].toString(),
  })),
})

function EditItem({ item, onClose, defaultStatus }: { item?: ToDoItem; onClose: () => any; defaultStatus?: bigint }) {
  const [content, setContent] = useState(item?.value.content || '')
  const [status, setStatus] = useState((defaultStatus || item?.value.status || STATUS_IDS.Pending).toString())

  const addItem = useMutation(ToDo.mutation('addItem'))
  const updateItem = useMutation(ToDo.mutation('updateItem'))
  const confirmed = !!(addItem.confirmation.data || updateItem.confirmation.data)

  useEffect(() => {
    if (confirmed) {
      onClose()
    }
  }, [confirmed])
  return (
    <VStack w="full">
      <Textarea autoFocus value={content} onChange={(e) => setContent(e.target.value)} maxLength={256} />
      <SelectRoot collection={statuses} value={[status]} onValueChange={(i) => setStatus(i.value[0])}>
        <SelectTrigger>
          <SelectValueText placeholder="Select movie" />
        </SelectTrigger>
        <SelectContent>
          {statuses.items.map((status) => (
            <SelectItem item={status} key={status.label}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
      <HStack w="full">
        <Button
          disabled={updateItem.isLoading || addItem.isLoading}
          flex={1}
          variant="subtle"
          size="xs"
          onClick={onClose}>
          Cancel
        </Button>
        <Button
          loading={updateItem.isLoading || addItem.isLoading}
          disabled={!content}
          flex={1}
          size="xs"
          onClick={() => {
            if (item) {
              updateItem.send(item.queryIndex, content, BigInt(status))
            } else {
              addItem.send(content, BigInt(status))
            }
          }}>
          Confirm
        </Button>
      </HStack>
    </VStack>
  )
}

function Item({ item }: { item: ToDoItem }) {
  const updateStatus = useMutation(ToDo.mutation('updateStatus'))
  const [editing, setEditing] = useState(false)
  const [side, setSide] = useState<'left' | 'right'>()
  return (
    <HStack bg="colorPalette.900" w="full" p={2} borderRadius={8}>
      {editing ? (
        <VStack w="full">
          <EditItem item={item} onClose={() => setEditing(false)} />
        </VStack>
      ) : (
        <>
          {item.value.status === STATUS_IDS.Pending ? null : (
            <IconButton
              size="xs"
              variant="ghost"
              disabled={updateStatus.isLoading}
              onClick={() => {
                setSide('left')
                updateStatus.send(item.queryIndex, item.value.status / 2n)
              }}>
              {updateStatus.isLoading && side === 'left' ? <Spinner /> : <IoIosArrowBack />}
            </IconButton>
          )}
          <VStack w="full" p={2} spaceY={2} onClick={() => setEditing(true)} cursor="pointer" alignItems="flex-start">
            <Text>{item.value.content}</Text>
          </VStack>
          {item.value.status === STATUS_IDS.Done ? null : (
            <IconButton
              size="xs"
              padding={0}
              variant="ghost"
              disabled={updateStatus.isLoading}
              onClick={() => {
                setSide('right')
                updateStatus.send(item.queryIndex, item.value.status * 2n)
              }}>
              {updateStatus.isLoading && side === 'right' ? <Spinner /> : <IoIosArrowForward />}
            </IconButton>
          )}
        </>
      )}
    </HStack>
  )
}

function List({ list, title, status }: { list: ToDoItemList; title: string; status: bigint }) {
  const [adding, setAdding] = useState(false)
  return (
    <VStack flex={1} spaceY={4} h="full">
      <HStack>
        <Heading>{title}</Heading>
        {list.length ? <Badge>{list.length}</Badge> : null}
      </HStack>
      <VStack spaceY={4} w="full" overflowY="auto" flex="1 1 auto" height="100px" p={4}>
        {adding ? (
          <HStack bg="colorPalette.900" w="full" p={2} borderRadius={8}>
            <EditItem key={list.length} onClose={() => setAdding(false)} defaultStatus={status} />
          </HStack>
        ) : (
          <HStack
            bg="colorPalette.900"
            w="full"
            p={2}
            borderRadius={8}
            justifyContent="center"
            onClick={() => setAdding(true)}
            cursor="pointer">
            <Icon>
              <PiPlus />
            </Icon>
          </HStack>
        )}
        {list.map((i) => {
          return <Item key={i.queryIndex.toString()} item={i} />
        })}
      </VStack>
    </VStack>
  )
}

export function HomeData() {
  const { address = zeroAddress } = useAccount()

  const total = useSingleQuery(ToDo.call.numItems(address).defaultTo(0n))
  const items = useItems(total.data, address)
  const classifiedItems = useMemo(
    () =>
      items.data
        .toSorted((i1, i2) => (i1.value.lastUpdated < i2.value.lastUpdated ? 1 : -1))
        .reduce(
          (acc, item) => {
            switch (item.value.status) {
              case STATUS_IDS.Pending:
                acc.pending.push(item)
                break
              case STATUS_IDS.Doing:
                acc.doing.push(item)
                break
              case STATUS_IDS.Done:
                acc.done.push(item)
                break
            }
            return acc
          },
          {
            pending: [] as typeof items.data,
            doing: [] as typeof items.data,
            done: [] as typeof items.data,
          },
        ),
    [items.data],
  )

  return (
    <VStack spaceY={4} height="100vh" overflowY="hidden">
      <HStack w="full" p={4} justifyContent="space-between" borderBottomWidth={1}>
        <Heading>
          ToDo <Badge>powered by DappQL</Badge>
        </Heading>
        <HStack spaceX={4}>
          {/* <Badge>Current Block: {currentBlock.toString()}</Badge> */}
          <ConnectButton label="Connect" showBalance={false} />
        </HStack>
      </HStack>

      <VStack flex={1} w="full" spaceY={4}>
        <HStack spaceX={4} w="full" maxW="1000px" alignItems="flex-start" flex={1}>
          <List title="Pending" list={classifiedItems.pending} status={STATUS_IDS.Pending} />
          <List title="Doing" list={classifiedItems.doing} status={STATUS_IDS.Doing} />
          <List title="Done" list={classifiedItems.done} status={STATUS_IDS.Done} />
        </HStack>
      </VStack>
    </VStack>
  )
}

export default function Home() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return <HomeData />
}
