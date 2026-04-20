import {
  Badge,
  Box,
  createListCollection,
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerPositioner,
  DrawerRoot,
  DrawerTitle,
  Heading,
  HStack,
  Icon,
  IconButton,
  Image,
  Link,
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
import { useIteratorContextQuery, useMutation, useSingleContextQuery } from '@dappql/react'
import { useEffect, useMemo, useState } from 'react'
import { useAccount, useBlockNumber, useConnect, useDisconnect } from 'wagmi'
import { Address, zeroAddress } from 'viem'

import { FaCode, FaEthereum, FaGithub } from 'react-icons/fa'
import { IoIosArrowBack, IoIosArrowForward } from 'react-icons/io'
import { PiPlus } from 'react-icons/pi'
import { Button } from '~/components/ui/button'
import { ToDo } from '~/contracts'

const REPO_URL = 'https://github.com/dappql/core/tree/main/apps/test-app'
const DAPPQL_URL = 'https://dappql.com'
const CONTRACT_URL = `https://sepolia.etherscan.io/address/${ToDo.deployAddress}#code`

const STATUS_IDS = {
  Pending: 1n,
  Doing: 2n,
  Done: 4n,
}

function ConnectButton() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <Button size="sm" onClick={() => disconnect()}>
        {`${address.slice(0, 6)}…${address.slice(-4)}`}
      </Button>
    )
  }

  return (
    <Button size="sm" onClick={() => connect({ connector: connectors[0] })}>
      Connect
    </Button>
  )
}

const useItems = (total: bigint, address: Address) => {
  return useIteratorContextQuery(total, (index: bigint) => ToDo.call.item(address, index), 1n)
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

  const addItem = useMutation(ToDo.mutation.addItem)
  const updateItem = useMutation(ToDo.mutation.updateItem)
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
          onClick={async () => {
            if (item) {
              try {
                updateItem.send(item.queryIndex, content, BigInt(status))
              } catch (e) {
                console.error(e)
              }
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
  const updateStatus = useMutation(ToDo.mutation.updateStatus)
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
  const { address = zeroAddress, isConnected } = useAccount()
  const { data: blockNumber } = useBlockNumber({ watch: true })
  const [sourceOpen, setSourceOpen] = useState(false)

  const total = useSingleContextQuery(ToDo.call.numItems(address).defaultTo(0n))
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
    <VStack spaceY={0} height="100vh" overflowY="hidden">
      <HStack w="full" p={4} justifyContent="space-between" borderBottomWidth={1}>
        <HStack spaceX={3}>
          <Heading>ToDo</Heading>
          <Link
            href={DAPPQL_URL}
            target="_blank"
            rel="noreferrer"
            _hover={{ textDecoration: 'none', opacity: 0.8 }}>
            <HStack spaceX={1.5} alignItems="center">
              <Text fontSize="xs" color="fg.muted">
                powered by
              </Text>
              <Image src="/logo-dappql.svg" alt="DappQL" height="22px" />
            </HStack>
          </Link>
        </HStack>
        <HStack spaceX={2}>
          {blockNumber ? (
            <Badge variant="subtle" title="Watching Sepolia. Every read refetches per block.">
              Block {blockNumber.toString()}
            </Badge>
          ) : null}
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Show DappQL code behind this demo"
            onClick={() => setSourceOpen(true)}>
            <FaCode />
          </IconButton>
          <IconButton asChild size="sm" variant="ghost" aria-label="View contract on Sepolia Etherscan">
            <a href={CONTRACT_URL} target="_blank" rel="noreferrer">
              <FaEthereum />
            </a>
          </IconButton>
          <IconButton asChild size="sm" variant="ghost" aria-label="View source on GitHub">
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              <FaGithub />
            </a>
          </IconButton>
          <ConnectButton />
        </HStack>
      </HStack>

      {isConnected ? (
        <VStack flex={1} w="full" spaceY={4} p={4} overflowY="hidden">
          <HStack spaceX={4} w="full" maxW="1000px" alignItems="flex-start" flex={1}>
            <List title="Pending" list={classifiedItems.pending} status={STATUS_IDS.Pending} />
            <List title="Doing" list={classifiedItems.doing} status={STATUS_IDS.Doing} />
            <List title="Done" list={classifiedItems.done} status={STATUS_IDS.Done} />
          </HStack>
        </VStack>
      ) : (
        <VStack flex={1} w="full" justifyContent="center" alignItems="center" spaceY={5} p={8} textAlign="center">
          <Heading size="xl">Connect a wallet on Sepolia to start.</Heading>
          <Text color="fg.muted" maxW="540px">
            A minimal ToDo dApp showing off DappQL&apos;s typed hooks, cross-component multicall batching,
            per-block reactivity, and mutation lifecycle tracking. All three lists below will share a
            single RPC per block.
          </Text>
          <ConnectButton />
        </VStack>
      )}

      <HStack
        w="full"
        px={4}
        py={3}
        borderTopWidth={1}
        justifyContent="center"
        spaceX={3}
        fontSize="xs"
        color="fg.muted">
        <Text>Built with</Text>
        <Link href={DAPPQL_URL} target="_blank" rel="noreferrer" color="fg">
          DappQL
        </Link>
        <Text>·</Text>
        <Link href={`${DAPPQL_URL}/guide/getting-started`} target="_blank" rel="noreferrer" color="fg">
          Docs
        </Link>
        <Text>·</Text>
        <Link href={CONTRACT_URL} target="_blank" rel="noreferrer" color="fg">
          Contract
        </Link>
        <Text>·</Text>
        <Link href={REPO_URL} target="_blank" rel="noreferrer" color="fg">
          Source
        </Link>
      </HStack>

      <SourceDrawer open={sourceOpen} onOpenChange={setSourceOpen} />
    </VStack>
  )
}

function SourceDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <DrawerRoot open={open} onOpenChange={(e) => onOpenChange(e.open)} size="md" placement="end">
      <DrawerBackdrop />
      <DrawerPositioner>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>What DappQL is doing</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
          <VStack alignItems="stretch" spaceY={5}>
            <Section title="Provider (once, at the app root)">
              <CodeBlock>{`<DappQLProvider
  watchBlocks                 // refetch every read per block
  simulateMutations           // eth_call preflight on every tx
  onMutationUpdate={toast}    // one callback for the whole app
>
  {children}
</DappQLProvider>`}</CodeBlock>
              <Caption>
                Reactivity (the block badge in the header) and global toast UX are set up once here.
                Every hook below talks through this provider.
              </Caption>
            </Section>

            <Section title="Reads, fused into ONE multicall per block">
              <CodeBlock>{`// Total count
const total = useSingleContextQuery(
  ToDo.call.numItems(account).defaultTo(0n),
)

// All items — batches with the count above
const items = useIteratorContextQuery(
  total.data,
  (i) => ToDo.call.item(account, i),
  1n,
)`}</CodeBlock>
              <Caption>
                Every <code>useContextQuery</code> in the tree (the three columns, the header badge, anything
                else) fuses into a single multicall per refetch cycle. <code>.defaultTo(0n)</code> keeps{' '}
                <code>data</code> always-defined.
              </Caption>
            </Section>

            <Section title="Writes, typed args from the ABI">
              <CodeBlock>{`// Add an item
const addItem = useMutation(ToDo.mutation.addItem)
addItem.send('Buy milk', 1n)        // content, status
                                    // spread args, never an array

// Move between columns
const updateStatus = useMutation(ToDo.mutation.updateStatus)
updateStatus.send(itemId, newStatus)

addItem.isLoading               // signing OR mining
addItem.confirmation.isSuccess  // receipt confirmed`}</CodeBlock>
              <Caption>
                Mutations are fully typed from the contract ABI. The provider simulates each one first and
                aborts if it would revert. Toasts come from <code>onMutationUpdate</code>, not per-component
                handlers.
              </Caption>
            </Section>

            <Section title="Live reactivity">
              <CodeBlock>{`// useBlockNumber drives the badge; DappQL's watchBlocks
// drives the refetch cycle. Both tick on every Sepolia block.
const { data: blockNumber } = useBlockNumber({ watch: true })`}</CodeBlock>
              <Caption>
                The block number you see in the header ticks with every new block. Every{' '}
                <code>useContextQuery</code> on the page silently refetches at the same cadence.
              </Caption>
            </Section>

            <HStack pt={2} spaceX={3} fontSize="sm">
              <Link href={REPO_URL} target="_blank" rel="noreferrer" color="fg">
                Full source on GitHub
              </Link>
              <Text color="fg.muted">·</Text>
              <Link href={DAPPQL_URL} target="_blank" rel="noreferrer" color="fg">
                DappQL docs
              </Link>
            </HStack>
          </VStack>
        </DrawerBody>
        <DrawerCloseTrigger />
        </DrawerContent>
      </DrawerPositioner>
    </DrawerRoot>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <VStack alignItems="stretch" spaceY={2}>
      <Text fontWeight="semibold" fontSize="sm" color="fg">
        {title}
      </Text>
      {children}
    </VStack>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <Box
      as="pre"
      bg="bg.muted"
      borderWidth={1}
      borderRadius="md"
      p={3}
      overflowX="auto"
      fontSize="xs"
      lineHeight={1.55}
      fontFamily="mono"
      whiteSpace="pre">
      {children}
    </Box>
  )
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <Text fontSize="xs" color="fg.muted" lineHeight={1.5}>
      {children}
    </Text>
  )
}

export default function Home() {
  const [mounted, setMounted] = useState(true)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return <HomeData />
}
