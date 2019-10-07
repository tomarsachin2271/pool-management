import React, { Component } from 'react'
import { Container, Grid } from '@material-ui/core'
import { providerService, bPoolService } from 'core/services'
import { PoolParamsGrid, SwapForm, PoolListTokenTable, Loading } from 'components'

class PoolSwapView extends Component {
  constructor(props) {
    super(props)

    this.state = {
      address: '',
      pool: {
        poolParams: {},
        tokenParams: {},
        pendingTx: false,
        txError: null,
        loadedParams: false,
        loadedTokenParams: false
      },
      selectedSwap: 'exactAmountIn'
    }
  }

  async componentWillMount() {
    const { address } = this.props.match.params
    this.setState({ address })

    const provider = await providerService.getProvider()
    this.setState({ provider })

    await this.getParams()
    await this.getTokenParams()
  }

  async getParams() {
    const { address, provider, pool } = this.state
    const poolData = await bPoolService.getParams(provider, address)
    this.setState({
      pool: {
        ...pool,
        loadedParams: true,
        poolParams: poolData.data
      }
    })
  }

  async getTokenParams() {
    const { address, provider, pool } = this.state
    const tokenData = await bPoolService.getTokenParams(provider, address)
    this.setState({
      pool: {
        ...pool,
        loadedTokenParams: true,
        tokenParams: tokenData.data
      }
    })
  }

  render() {
    const { pool, address, provider } = this.state
    // this will be refactored.
    const setSwapSelection = (selectedSwap) => {
      this.setState({ selectedSwap })
    }
    return (
      <Container>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={12}>
            {
              pool.loadedParams ? (<PoolParamsGrid address={address} pool={pool} />) :
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Loading />
              </div>
            }
          </Grid>
          <Grid item xs={12}>
            {
              pool.loadedTokenParams ? (<PoolListTokenTable tokenParams={pool.tokenParams} address={address} provider={provider} linkPath="logs" />) :
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Loading />
              </div>
            }
          </Grid>
          <Grid container>
            <SwapForm updateTokenParams={this.getTokenParams} address={address} provider={provider} tokenParams={pool.tokenParams} setSwapSelection={setSwapSelection} />
          </Grid>
        </Grid>
      </Container>
    )
  }
}

export default PoolSwapView
