Rails.application.routes.draw do
  resource :session, only: [:new, :create, :destroy]
  get  "/login"  => "sessions#new",      as: :login
  delete "/logout" => "sessions#destroy", as: :logout

  resource :registration, only: [:new, :create]
  get "/signup" => "registrations#new"

  resource :preferences, only: [:edit, :update]
  delete "/preferences/tesco" => "preferences#clear_tesco_credentials", as: :clear_tesco_credentials

  get  "/list" => "lists#show", as: :list
  post "/list/clear" => "lists#clear", as: :clear_list
  post "/list/share_token/rotate" => "lists#rotate_share_token", as: :rotate_share_token
  scope "/list" do
    resources :list_items, path: "items", only: [:create, :update, :destroy]
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
  # root "posts#index"
end
