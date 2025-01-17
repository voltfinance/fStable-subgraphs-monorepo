import { Address, log } from '@graphprotocol/graph-ts'
import { metrics } from '@mstable/subgraph-utils'

import { SavingsContract as SavingsContractTemplate } from '../../generated/templates'
import {
  SavingsContractAdded,
  SavingsContractUpdated,
  SavingsRateChanged,
  LiquidatorDeposited,
  InterestCollected,
  InterestDistributed,
  StreamsFrozen,
} from '../../generated/SavingsManager.0x86818a2EACcDC6e1C2d7A301E4Ebb394a3c61b85/SavingsManager'
import {
  SavingsManager as SavingsManagerEntity,
  SavingsContract as SavingsContractEntity,
  Masset as MassetEntity,
} from '../../generated/schema'

import { getOrCreateMasset } from '../Masset'
import { getOrCreateSavingsContract } from '../SavingsContract'
import { SAVINGS_MANAGER_ID } from '../constants'

function addSavingsContract(massetAddress: Address, savingsContractAddress: Address): void {
  let savingsContractEntity = SavingsContractEntity.load(savingsContractAddress.toHexString())

  if (savingsContractEntity == null) {
    // If the entity doesn't exist (i.e. it wasn't pre-released), track events
    SavingsContractTemplate.create(savingsContractAddress)
  }

  // Create the savings contract and mark it as active
  savingsContractEntity = getOrCreateSavingsContract(savingsContractAddress, massetAddress)
  savingsContractEntity.active = true
  savingsContractEntity.save()

  // Set the savings contract as active on the Masset
  let massetEntity = getOrCreateMasset(massetAddress)
  massetEntity.currentSavingsContract = savingsContractEntity.id
  massetEntity.save()
}

let TEST_MASSET_1 = Address.fromHexString('0x05bea40d1590e751422472745ec2836a0d8d3630')
let TEST_MASSET_2 = Address.fromHexString('0xb5beccef3513b8a75a1c12e6d52ae6f582aaa584')
let TEST_MASSET_3 = Address.fromHexString('0xc8c0ae5465362cd671749e274b726612e992257d')
let TEST_MASSET_4 = Address.fromHexString('0x5f3e440bbc038a143fd115c0becb65bd0ecf6a7e')
let OLD_ROPSTEN_MUSD = Address.fromHexString('0x4e1000616990d83e56f4b5fc6cc8602dcfd20459')

export function handleSavingsContractAdded(event: SavingsContractAdded): void {
  // Exclude test massets
  if (
    event.params.mAsset.equals(TEST_MASSET_1) ||
    event.params.mAsset.equals(TEST_MASSET_2) ||
    event.params.mAsset.equals(TEST_MASSET_3) ||
    event.params.mAsset.equals(TEST_MASSET_4) ||
    event.params.mAsset.equals(OLD_ROPSTEN_MUSD)
  ) {
    return
  }

  updateSavingsManager(event.address)

  // Create the masset if it doesn't exist already
  // getOrCreateMasset(event.params.mAsset)

  addSavingsContract(event.params.mAsset, event.params.savingsContract)
}

export function handleSavingsContractUpdated(event: SavingsContractUpdated): void {
  // Exclude test massets
  if (
    event.params.mAsset.equals(TEST_MASSET_1) ||
    event.params.mAsset.equals(TEST_MASSET_2) ||
    event.params.mAsset.equals(TEST_MASSET_3) ||
    event.params.mAsset.equals(TEST_MASSET_4) ||
    event.params.mAsset.equals(OLD_ROPSTEN_MUSD)
  ) {
    return
  }

  updateSavingsManager(event.address)

  addSavingsContract(event.params.mAsset, event.params.savingsContract)
}

export function handleSavingsRateChanged(event: SavingsRateChanged): void {
  metrics.update(event.address, 'savingsRate', event.params.newSavingsRate)
}

export function handleStreamsFrozen(event: StreamsFrozen): void {
  let savingsManagerEntity = new SavingsManagerEntity(event.address.toHexString())
  savingsManagerEntity.streamsFrozen = true
  savingsManagerEntity.save()
}

export function handleLiquidatorDeposited(event: LiquidatorDeposited): void {
  metrics.increment(event.params.mAsset, 'cumulativeLiquidatorDeposited', event.params.amount)
}

export function handleInterestCollected(event: InterestCollected): void {
  metrics.increment(event.params.mAsset, 'cumulativeInterestCollected', event.params.interest)
}

export function handleInterestDistributed(event: InterestDistributed): void {
  metrics.increment(event.params.mAsset, 'cumulativeInterestDistributed', event.params.amountSent)
}

function updateSavingsManager(address: Address): SavingsManagerEntity {
  let savingsManagerEntity = new SavingsManagerEntity(SAVINGS_MANAGER_ID)
  savingsManagerEntity.address = address
  savingsManagerEntity.streamsFrozen = false
  savingsManagerEntity.savingsRate = metrics.getOrCreate(address, 'savingsRate').id
  savingsManagerEntity.save()

  return savingsManagerEntity as SavingsManagerEntity
}
