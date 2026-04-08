class BasketMailer < ApplicationMailer
  default from: "Kart <hello@kart.app>"

  def ready(basket_build)
    @basket_build = basket_build
    @user = basket_build.user
    @build_url = build_url_for(basket_build)
    mail(to: @user.email, subject: "Your Tesco basket is ready.")
  end

  private

  def build_url_for(basket_build)
    host = ENV["APP_HOST"].presence || "http://localhost:3000"
    "#{host}/builds/#{basket_build.id}"
  end
end
