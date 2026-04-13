Rails.application.routes.draw do
  resource :session, only: [:new, :create, :destroy]
  get  "/login"  => "sessions#new",      as: :login
  delete "/logout" => "sessions#destroy", as: :logout

  resource :registration, only: [:new, :create]
  get "/signup" => "registrations#new"

  resource :preferences, only: [:edit, :update]

  resource :tesco_session, only: [:create, :destroy] do
    post :complete, on: :member
    get  :poll,     on: :member
  end

  get  "/list" => "lists#show", as: :list
  post "/list/clear" => "lists#clear", as: :clear_list
  post "/list/share_token/rotate" => "lists#rotate_share_token", as: :rotate_share_token
  scope "/list" do
    resources :list_items, path: "items", only: [:create, :update, :destroy]
  end

  post "/webhooks/stripe"  => "webhooks/stripe#create"

  get  "/billing"          => "billing#show",     as: :billing
  post "/billing/checkout" => "billing#checkout", as: :checkout_billing
  get  "/billing/portal"   => "billing#portal",   as: :portal_billing

  resources :basket_builds, only: [:create, :show], path: "builds" do
    member do
      post :existing_basket_decision
      post :resume
      post :corrections
      get  :correction_picker
    end
  end

  get "/internal/tesco/search" => "internal/tesco_search#show", as: :internal_tesco_search

  namespace :internal do
    get  "/users/:user_id/product_matches" => "product_matches#show",   as: :user_product_matches
    post "/users/:user_id/product_matches" => "product_matches#create"

    post "/builds/:id/existing_basket_detected" => "basket_build_callbacks#existing_basket_detected", as: :build_existing_basket_detected
    post "/builds/:id/progress"              => "basket_build_callbacks#progress",              as: :build_progress
    post "/builds/:id/verification_required" => "basket_build_callbacks#verification_required", as: :build_verification_required
    post "/builds/:id/completed"             => "basket_build_callbacks#completed",             as: :build_completed
    post "/builds/:id/failed"                => "basket_build_callbacks#failed",                as: :build_failed
    post "/builds/:id/session_expired"       => "basket_build_callbacks#session_expired",       as: :build_session_expired
  end

  scope "/s/:share_token", as: :shared do
    get "" => "shared_lists#show", as: :list
    resources :list_items, path: "items", only: [:create, :update, :destroy], module: "shared"
  end
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  root "lists#show"
end
