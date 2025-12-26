/**
 * Subscription Routes for Multi-Tenant SaaS
 * Handles Stripe billing, plans, and subscription management
 */
import { Router, Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import Stripe from 'stripe'
import { organizationsDAL, auditLogsDAL } from '../lib/dal.js'
import { requireAuth, requireOwner, AuthRequest } from '../middleware/auth.js'
import { requireTenant, TenantRequest } from '../middleware/tenant.js'

const router = Router()

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder')

// Plan configuration - Only paid plans (Starter and Pro)
const PLANS = {
  starter: {
    name: 'Starter',
    price: 49,
    priceId: process.env.STRIPE_PRICE_STARTER,
    plants: 3,
    users: 5,
    apiCalls: 5000,
    storage: '5GB',
    features: ['basic_analytics', 'advanced_reports', 'email_support', 'api_access', 'dwg_viewer']
  },
  pro: {
    name: 'Pro',
    price: 149,
    priceId: process.env.STRIPE_PRICE_PRO,
    plants: 10,
    users: 25,
    apiCalls: 50000,
    storage: '50GB',
    features: ['basic_analytics', 'advanced_reports', 'email_support', 'api_access', 'dwg_viewer', 'webhooks', 'priority_support', 'custom_branding', 'white_label']
  }
}

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  const plans = Object.entries(PLANS).map(([key, plan]) => ({
    id: key,
    name: plan.name,
    price: plan.price,
    limits: {
      plants: plan.plants,
      users: plan.users,
      apiCalls: plan.apiCalls
    },
    features: plan.features
  }))

  res.json({ success: true, data: plans })
})

/**
 * GET /api/subscriptions/current
 * Get current subscription status
 */
router.get('/current', requireAuth, requireTenant, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest

  try {
    const org = tenantReq.tenant!.organization as any

    const planConfig = PLANS[org.plan as keyof typeof PLANS] || PLANS.starter

    res.json({
      success: true,
      data: {
        plan: org.plan,
        planDetails: {
          name: planConfig.name,
          price: planConfig.price,
          limits: {
            plants: planConfig.plants,
            users: planConfig.users,
            apiCalls: planConfig.apiCalls
          },
          features: planConfig.features
        },
        status: org.subscription_status || 'active',
        trialEndsAt: org.trial_ends_at,
        currentPeriodEnd: org.current_period_end,
        cancelAtPeriodEnd: org.cancel_at_period_end || false
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/subscriptions/create-checkout
 * Create Stripe Checkout session for subscription
 */
router.post(
  '/create-checkout',
  requireAuth,
  requireTenant,
  requireOwner,
  [
    body('plan').isIn(['starter', 'pro']),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const tenantReq = req as TenantRequest & AuthRequest
    const { plan } = req.body

    try {
      const org = tenantReq.tenant!.organization as any
      const planConfig = PLANS[plan as keyof typeof PLANS] as any

      if (!planConfig.priceId) {
        return res.status(400).json({
          success: false,
          error: 'Plan not available for purchase',
          code: 'PLAN_NOT_AVAILABLE'
        })
      }

      // Create or get Stripe customer
      let customerId = org.stripe_customer_id

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: tenantReq.user!.email,
          name: org.name,
          metadata: {
            organizationId: org.id,
            organizationSlug: org.slug
          }
        })
        customerId = customer.id

        organizationsDAL.update(org.id, {
          stripeCustomerId: customerId
        })
      }

      // Create Checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: planConfig.priceId,
            quantity: 1
          }
        ],
        success_url: `${process.env.APP_URL}/org/${org.slug}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.APP_URL}/org/${org.slug}/billing?cancelled=true`,
        metadata: {
          organizationId: org.id,
          plan
        },
        subscription_data: {
          metadata: {
            organizationId: org.id,
            plan
          }
        },
        allow_promotion_codes: true
      })

      // Log audit
      auditLogsDAL.create(org.id, {
        userId: tenantReq.user!.sub,
        action: 'subscription.checkout_created',
        entityType: 'subscription',
        entityId: session.id,
        newValue: { plan },
        ipAddress: req.ip || undefined
      })

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          url: session.url
        }
      })
    } catch (error: any) {
      console.error('Stripe checkout error:', error)
      res.status(500).json({ success: false, error: 'Failed to create checkout session' })
    }
  }
)

/**
 * POST /api/subscriptions/create-portal
 * Create Stripe Customer Portal session for managing subscription
 */
router.post('/create-portal', requireAuth, requireTenant, requireOwner, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest

  try {
    const org = tenantReq.tenant!.organization as any

    if (!org.stripe_customer_id) {
      return res.status(400).json({
        success: false,
        error: 'No billing account found',
        code: 'NO_BILLING_ACCOUNT'
      })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${process.env.APP_URL}/org/${org.slug}/billing`
    })

    res.json({
      success: true,
      data: {
        url: session.url
      }
    })
  } catch (error: any) {
    console.error('Stripe portal error:', error)
    res.status(500).json({ success: false, error: 'Failed to create portal session' })
  }
})

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription at period end
 */
router.post('/cancel', requireAuth, requireTenant, requireOwner, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest & AuthRequest

  try {
    const org = tenantReq.tenant!.organization as any

    if (!org.stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        error: 'No active subscription',
        code: 'NO_SUBSCRIPTION'
      })
    }

    // Cancel at period end
    await stripe.subscriptions.update(org.stripe_subscription_id, {
      cancel_at_period_end: true
    })

    organizationsDAL.update(org.id, {
      cancelAtPeriodEnd: true
    })

    // Log audit
    auditLogsDAL.create(org.id, {
      userId: tenantReq.user!.sub,
      action: 'subscription.cancelled',
      entityType: 'subscription',
      entityId: org.stripe_subscription_id,
      ipAddress: req.ip || undefined
    })

    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the billing period'
    })
  } catch (error: any) {
    console.error('Cancel subscription error:', error)
    res.status(500).json({ success: false, error: 'Failed to cancel subscription' })
  }
})

/**
 * POST /api/subscriptions/resume
 * Resume a cancelled subscription
 */
router.post('/resume', requireAuth, requireTenant, requireOwner, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest & AuthRequest

  try {
    const org = tenantReq.tenant!.organization as any

    if (!org.stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        error: 'No subscription to resume',
        code: 'NO_SUBSCRIPTION'
      })
    }

    // Resume subscription
    await stripe.subscriptions.update(org.stripe_subscription_id, {
      cancel_at_period_end: false
    })

    organizationsDAL.update(org.id, {
      cancelAtPeriodEnd: false
    })

    // Log audit
    auditLogsDAL.create(org.id, {
      userId: tenantReq.user!.sub,
      action: 'subscription.resumed',
      entityType: 'subscription',
      entityId: org.stripe_subscription_id,
      ipAddress: req.ip || undefined
    })

    res.json({
      success: true,
      message: 'Subscription resumed successfully'
    })
  } catch (error: any) {
    console.error('Resume subscription error:', error)
    res.status(500).json({ success: false, error: 'Failed to resume subscription' })
  }
})

/**
 * GET /api/subscriptions/invoices
 * Get invoice history
 */
router.get('/invoices', requireAuth, requireTenant, requireOwner, async (req: Request, res: Response) => {
  const tenantReq = req as TenantRequest

  try {
    const org = tenantReq.tenant!.organization as any

    if (!org.stripe_customer_id) {
      return res.json({ success: true, data: [] })
    }

    const invoices = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      limit: 24
    })

    const formattedInvoices = invoices.data.map(inv => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount: inv.total / 100,
      currency: inv.currency.toUpperCase(),
      date: new Date(inv.created * 1000).toISOString(),
      pdfUrl: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url
    }))

    res.json({ success: true, data: formattedInvoices })
  } catch (error: any) {
    console.error('Get invoices error:', error)
    res.status(500).json({ success: false, error: 'Failed to get invoices' })
  }
})

/**
 * POST /api/subscriptions/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!endpointSecret) {
    console.error('Stripe webhook secret not configured')
    return res.status(500).json({ error: 'Webhook not configured' })
  }

  let event: Stripe.Event

  try {
    // Note: In production, use raw body parsing for webhooks
    event = stripe.webhooks.constructEvent(
      JSON.stringify(req.body),
      sig,
      endpointSecret
    )
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message)
    return res.status(400).json({ error: 'Webhook signature verification failed' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { organizationId, plan } = session.metadata || {}

        if (organizationId && plan) {
          organizationsDAL.update(organizationId, {
            plan,
            stripeSubscriptionId: session.subscription as string,
            subscriptionStatus: 'active'
          })

          // Log audit
          auditLogsDAL.create(organizationId, {
            action: 'subscription.activated',
            entityType: 'subscription',
            entityId: session.subscription as string,
            newValue: { plan }
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const { organizationId, plan } = subscription.metadata || {}

        if (organizationId) {
          organizationsDAL.update(organizationId, {
            subscriptionStatus: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const { organizationId } = subscription.metadata || {}

        if (organizationId) {
          // When subscription is deleted, downgrade to starter (no free plan)
          organizationsDAL.update(organizationId, {
            plan: 'starter',
            stripeSubscriptionId: undefined,
            subscriptionStatus: 'cancelled'
          })

          // Log audit
          auditLogsDAL.create(organizationId, {
            action: 'subscription.expired',
            entityType: 'subscription',
            entityId: subscription.id
          })
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subscription = invoice.subscription as string

        // Update subscription status
        if (subscription) {
          const sub = await stripe.subscriptions.retrieve(subscription)
          const { organizationId } = sub.metadata || {}

          if (organizationId) {
            organizationsDAL.update(organizationId, {
              subscriptionStatus: 'active'
            })
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscription = invoice.subscription as string

        if (subscription) {
          const sub = await stripe.subscriptions.retrieve(subscription)
          const { organizationId } = sub.metadata || {}

          if (organizationId) {
            organizationsDAL.update(organizationId, {
              subscriptionStatus: 'past_due'
            })

            // Log audit
            auditLogsDAL.create(organizationId, {
              action: 'subscription.payment_failed',
              entityType: 'subscription',
              entityId: subscription
            })
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    res.json({ received: true })
  } catch (error: any) {
    console.error('Webhook processing error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

export default router
